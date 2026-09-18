const fs = require('fs');
const path = require('path');
const { discoverEsclDevices, runEsclScan } = require('../escl-scanner');
const { createNaps2Provider } = require('./naps2-scanner');
const { createSaneProvider } = require('./sane-scanner');
const { generatedScanPath, validateScanBuffer } = require('./scan-output');
const { loadScannerMappings, mappingForSerial, normalizeSerial } = require('./scanner-mapping');

function nativeDevice(mapping, printer, capabilities) {
  const printerId = Number(printer?.id) || null;
  const label = printer?.name || capabilities?.model || `Scanner ${mapping.serial}`;
  return {
    id: `naps2:${Buffer.from(mapping.serial).toString('base64url')}`,
    label: `${label} · ${mapping.driver.toUpperCase()}`,
    kind: 'naps2',
    printerId,
    mapping,
    sources: ['Flatbed', 'ADF', 'ADF Duplex'],
  };
}

function createScannerManager(options = {}) {
  const logger = options.logger || console;
  const getPrinters = options.getPrinters || (() => []);
  const naps2 = createNaps2Provider({
    scanDirectory: options.scanDirectory,
    consolePath: options.naps2ConsolePath,
    platform: options.platform,
    spawn: options.spawn,
    fs: options.fs,
  });
  const sane = createSaneProvider({
    scanDirectory: options.scanDirectory,
    assignedPrinterIdForScanner: options.assignedPrinterIdForScanner,
    execFile: options.execFile,
  });
  let nativeDiagnosticsCache = null;
  const busyScanners = new Set();

  function mappings() {
    return loadScannerMappings({
      filePath: options.mappingFile,
      platform: options.platform,
      fs: options.mappingFs,
      env: options.env,
    });
  }

  async function nativeDiagnostics(mappingResult) {
    const drivers = [...new Set([...mappingResult.mappings.values()].map((item) => item.driver))];
    if (nativeDiagnosticsCache && nativeDiagnosticsCache.expiresAt > Date.now()) return nativeDiagnosticsCache.value;
    const value = await naps2.diagnostics(drivers);
    nativeDiagnosticsCache = { expiresAt: Date.now() + 30000, value };
    return value;
  }

  async function inventory() {
    const printers = getPrinters();
    const mappingResult = mappings();
    const [esclDevices, saneDevices, naps2Diagnostics] = await Promise.all([
      discoverEsclDevices(printers),
      sane.listDevices(),
      nativeDiagnostics(mappingResult),
    ]);
    const selected = [];
    const coveredPrinterIds = new Set();
    const coveredSerials = new Set();

    for (const printer of printers) {
      const discovered = esclDevices.find((device) => Number(device.printerId) === Number(printer.id));
      const serial = normalizeSerial(printer.serial) || normalizeSerial(discovered?.serialNumber);
      const mapping = mappingForSerial(mappingResult, serial);
      if (!mapping) continue;
      const detectedDevices = naps2Diagnostics.devices?.[mapping.driver];
      if (!naps2Diagnostics.available || !Array.isArray(detectedDevices) || !detectedDevices.includes(mapping.device)) continue;
      selected.push(nativeDevice(mapping, printer, discovered));
      coveredSerials.add(mapping.serial);
      if (printer.id) coveredPrinterIds.add(Number(printer.id));
    }

    for (const device of esclDevices) {
      if (coveredPrinterIds.has(Number(device.printerId))) continue;
      if (device.kind === 'escl-legacy' || device.usable === false) continue;
      selected.push(device);
      if (device.printerId) coveredPrinterIds.add(Number(device.printerId));
    }

    for (const device of saneDevices) {
      if (device.printerId && coveredPrinterIds.has(Number(device.printerId))) continue;
      selected.push(device);
    }
    return { devices: selected, mappingResult, coveredSerials, esclDevices, naps2Diagnostics };
  }

  return {
    async listDevices() {
      return (await inventory()).devices;
    },
    async resolveDevice(deviceId) {
      const device = (await this.listDevices()).find((item) => item.id === String(deviceId));
      if (!device) throw new Error('The selected scanner is no longer available.');
      return device;
    },
    async scan(device, source) {
      const physicalKey = normalizeSerial(device.mapping?.serial || device.serialNumber)
        || (device.printerId ? `printer:${device.printerId}` : `${device.kind}:${device.id}`);
      if (busyScanners.has(physicalKey)) throw new Error('The selected scanner is already processing a scan.');
      busyScanners.add(physicalKey);
      try {
        if (device.kind === 'naps2') {
          const result = await naps2.scan(device.mapping, {
            source: source === 'ADF Duplex' ? 'adf-duplex' : source === 'ADF' ? 'adf' : 'flatbed',
          });
          return {
            name: path.basename(result.filePath), mimeType: result.mimeType, source,
            provider: 'naps2', printerId: device.printerId, serial: device.mapping.serial,
          };
        }
        if (device.kind === 'escl') {
          const scan = await runEsclScan(device, source);
          const metadata = validateScanBuffer(scan.buffer);
          const filePath = generatedScanPath(options.scanDirectory, metadata.extension);
          await fs.promises.writeFile(filePath, scan.buffer, { flag: 'wx' });
          return {
            name: path.basename(filePath), mimeType: metadata.mimeType, source,
            provider: 'escl', printerId: device.printerId, serial: device.serialNumber || null,
          };
        }
        if (device.kind === 'sane') {
          const result = await sane.scan(device, { source });
          return {
            name: path.basename(result.filePath), mimeType: result.mimeType, source,
            provider: 'sane', printerId: device.printerId, serial: null,
          };
        }
        throw new Error('The selected scanner provider is not supported.');
      } finally {
        busyScanners.delete(physicalKey);
      }
    },
    async logDiagnostics() {
      const { mappingResult, esclDevices, naps2Diagnostics: diagnostics } = await inventory();
      if (!mappingResult.exists) logger.warn(`[Scanner] Mapping file not found: ${mappingResult.filePath}. Native scanner mappings are disabled.`);
      for (const error of mappingResult.errors) logger.error(`[Scanner] Mapping error: ${error}`);
      logger.log(`[Scanner] NAPS2 executable: ${diagnostics.available ? 'available' : 'not available'}${diagnostics.command ? ` (${diagnostics.command})` : ''}.`);
      if (diagnostics.version) logger.log(`[Scanner] NAPS2 version: ${diagnostics.version}.`);
      logger.log(`[Scanner] Valid native scanner mappings for this platform: ${mappingResult.mappings.size}.`);
      for (const [driver, devices] of Object.entries(diagnostics.devices || {})) {
        logger.log(`[Scanner] ${driver.toUpperCase()} device discovery: ${Array.isArray(devices) ? `${devices.length} device(s)` : 'failed'}.`);
      }
      for (const mapping of mappingResult.mappings.values()) {
        const listed = diagnostics.devices?.[mapping.driver];
        const detected = Array.isArray(listed) && listed.includes(mapping.device);
        logger.log(`[Scanner] Mapping ${mapping.serial} via ${mapping.driver.toUpperCase()}: ${detected ? 'device detected' : 'device not detected'}.`);
      }
      const legacy = esclDevices.filter((device) => device.kind === 'escl-legacy');
      if (legacy.length) logger.warn(`[Scanner] ${legacy.length} legacy CloudScan/eSCL device(s) excluded from direct eSCL scanning; configure a native serial mapping.`);
      return { mappingResult, diagnostics, legacyCount: legacy.length };
    },
    async shutdown() {
      await Promise.allSettled([naps2.shutdown(), sane.shutdown()]);
    },
    async cancelActiveScans() {
      await naps2.cancelActiveScans();
    },
  };
}

module.exports = { createScannerManager, nativeDevice };
