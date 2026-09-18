const fs = require('fs');
const os = require('os');
const path = require('path');

const SUPPORTED_PROVIDERS = new Set(['naps2']);
const SUPPORTED_DRIVERS = {
  win32: new Set(['wia', 'twain']),
  darwin: new Set(['apple']),
};

function defaultMappingPath(platform = process.platform, env = process.env) {
  if (platform === 'win32') {
    const programData = env.ProgramData || env.PROGRAMDATA || 'C:\\ProgramData';
    return path.win32.join(programData, 'SEAOIL', 'PrinterAgent', 'config', 'scanner-devices.json');
  }
  if (platform === 'darwin') {
    return '/Library/Application Support/SEAOIL/PrinterAgent/config/scanner-devices.json';
  }
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'seaoil-printer-agent', 'scanner-devices.json');
}

function normalizeSerial(value) {
  if (typeof value !== 'string') return null;
  const serial = value.trim().toUpperCase();
  return /^[A-Z0-9._-]{1,128}$/.test(serial) ? serial : null;
}

function platformSection(platform) {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  return null;
}

function validateMappingDocument(document, platform = process.platform) {
  const errors = [];
  const allowedRootKeys = new Set(['version', 'scanners']);
  if (!document || Array.isArray(document) || typeof document !== 'object') {
    return { ok: false, errors: ['Mapping file must contain a JSON object.'], mappings: new Map() };
  }
  for (const key of Object.keys(document)) {
    if (!allowedRootKeys.has(key)) errors.push(`Unsupported root key: ${key}`);
  }
  if (document.version !== 1) errors.push('Mapping version must be 1.');
  if (!document.scanners || Array.isArray(document.scanners) || typeof document.scanners !== 'object') {
    errors.push('scanners must be an object keyed by serial number.');
  }

  const mappings = new Map();
  const section = platformSection(platform);
  const scannerEntries = document.scanners && !Array.isArray(document.scanners) && typeof document.scanners === 'object'
    ? Object.entries(document.scanners)
    : [];
  for (const [serialKey, entry] of scannerEntries) {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') {
      errors.push(`scanners.${serialKey} must be an object.`);
      continue;
    }
    const allowedEntryKeys = new Set(['windows', 'macos']);
    for (const key of Object.keys(entry)) {
      if (!allowedEntryKeys.has(key)) errors.push(`scanners.${serialKey} has unsupported key: ${key}`);
    }
    const serial = normalizeSerial(serialKey);
    if (!serial) {
      errors.push(`Scanner serial key is invalid: ${serialKey}`);
      continue;
    }
    if (mappings.has(serial)) {
      errors.push(`Duplicate scanner serial: ${serial}`);
      continue;
    }
    if (!section || entry[section] == null) continue;
    const config = entry[section];
    if (!config || Array.isArray(config) || typeof config !== 'object') {
      errors.push(`scanners.${serialKey}.${section} must be an object.`);
      continue;
    }
    const allowedConfigKeys = new Set(['provider', 'driver', 'device']);
    for (const key of Object.keys(config)) {
      if (!allowedConfigKeys.has(key)) errors.push(`scanners.${serialKey}.${section} has unsupported key: ${key}`);
    }
    const provider = typeof config.provider === 'string' ? config.provider.trim().toLowerCase() : '';
    const driver = typeof config.driver === 'string' ? config.driver.trim().toLowerCase() : '';
    const device = typeof config.device === 'string' ? config.device.trim() : '';
    if (!SUPPORTED_PROVIDERS.has(provider)) errors.push(`scanners.${serialKey}.${section}.provider must be naps2.`);
    if (!SUPPORTED_DRIVERS[platform]?.has(driver)) errors.push(`scanners.${serialKey}.${section}.driver is not supported on this platform.`);
    if (!device || device.length > 512 || /[\r\n\0]/.test(device)) errors.push(`scanners.${serialKey}.${section}.device is invalid.`);
    if (SUPPORTED_PROVIDERS.has(provider) && SUPPORTED_DRIVERS[platform]?.has(driver) && device && device.length <= 512 && !/[\r\n\0]/.test(device)) {
      mappings.set(serial, { serial, provider, driver, device });
    }
  }
  return { ok: errors.length === 0, errors, mappings };
}

function loadScannerMappings(options = {}) {
  const platform = options.platform || process.platform;
  const filePath = options.filePath || process.env.SCANNER_DEVICE_MAP_FILE || defaultMappingPath(platform, options.env);
  const fileSystem = options.fs || fs;
  try {
    const document = JSON.parse(fileSystem.readFileSync(filePath, 'utf8'));
    return { filePath, exists: true, ...validateMappingDocument(document, platform) };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { filePath, exists: false, ok: true, errors: [], mappings: new Map() };
    }
    return { filePath, exists: true, ok: false, errors: [`Unable to load scanner mappings: ${error.message}`], mappings: new Map() };
  }
}

function mappingForSerial(mappingResult, serial) {
  const normalized = normalizeSerial(serial);
  return normalized ? mappingResult?.mappings?.get(normalized) || null : null;
}

module.exports = {
  defaultMappingPath,
  loadScannerMappings,
  mappingForSerial,
  normalizeSerial,
  validateMappingDocument,
};
