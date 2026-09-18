const { execFile } = require('child_process');
const path = require('path');
const { generatedScanPath, validateScanFile } = require('./scan-output');

function parseSaneDeviceList(output, assignedPrinterIdForScanner = () => null) {
  const devices = [];
  for (const line of String(output || '').split(/\r?\n/)) {
    const match = line.match(/device `([^']+)' is a (.+)/);
    if (!match) continue;
    devices.push({
      id: `sane:${Buffer.from(match[1]).toString('base64url')}`,
      backendId: match[1],
      label: match[2],
      kind: 'sane',
      printerId: assignedPrinterIdForScanner(match[1], match[2]),
      sources: ['Flatbed', 'ADF', 'ADF Duplex'],
    });
  }
  return devices;
}

function execute(file, args, options = {}) {
  const runner = options.execFile || execFile;
  return new Promise((resolve, reject) => {
    runner(file, args, { timeout: options.timeoutMs || 30000, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(String(stderr || error.message).trim()));
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

function createSaneProvider(options = {}) {
  const busyDevices = new Set();
  return {
    id: 'sane',
    async listDevices() {
      try {
        const result = await execute('scanimage', ['-L'], { execFile: options.execFile, timeoutMs: 30000 });
        return parseSaneDeviceList(result.stdout, options.assignedPrinterIdForScanner);
      } catch {
        return [];
      }
    },
    async scan(device, scanOptions = {}) {
      const backendId = device?.backendId;
      if (!backendId || /[\r\n\0]/.test(backendId)) throw new Error('The selected SANE scanner is invalid.');
      if (busyDevices.has(backendId)) throw new Error('The selected scanner is already processing a scan.');
      busyDevices.add(backendId);
      const outputPath = generatedScanPath(options.scanDirectory, '.pdf');
      try {
        const args = ['-d', backendId, '--format=pdf', '-o', outputPath];
        if (scanOptions.source && scanOptions.source !== 'Flatbed') args.push('--source', scanOptions.source);
        await execute('scanimage', args, { execFile: options.execFile, timeoutMs: options.timeoutMs || 120000 });
        return await validateScanFile(outputPath, options.scanDirectory, { maxBytes: options.maxBytes });
      } finally {
        busyDevices.delete(backendId);
      }
    },
    async shutdown() {},
  };
}

module.exports = { createSaneProvider, execute, parseSaneDeviceList };
