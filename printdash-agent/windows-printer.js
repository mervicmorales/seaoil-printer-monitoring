'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.txt', '.jpg', '.jpeg', '.png']);
const PRINT_EXIT_MESSAGES = new Map([
  [2, 'The print file could not be opened or its format is unsupported'],
  [3, 'The document does not allow printing'],
  [4, 'The configured Windows printer queue does not exist'],
  [5, 'The Windows printer driver or device rejected the job'],
  [6, 'Printing is disabled by Windows policy'],
]);

function programDataPath(env = process.env) {
  return env.ProgramData || env.PROGRAMDATA || 'C:\\ProgramData';
}

function defaultPrinterMappingPath(env = process.env) {
  return path.win32.join(programDataPath(env), 'SEAOIL', 'PrinterAgent', 'config', 'printer-queues.json');
}

function defaultSumatraPath(env = process.env) {
  return path.win32.join(programDataPath(env), 'SEAOIL', 'PrinterAgent', 'tools', 'SumatraPDF', 'SumatraPDF.exe');
}

function defaultSumatraAppDataPath(env = process.env) {
  return path.win32.join(programDataPath(env), 'SEAOIL', 'PrinterAgent', 'run', 'sumatrapdf');
}

function normalizeSerial(value) {
  if (typeof value !== 'string') return null;
  const serial = value.trim().toUpperCase();
  return /^[A-Z0-9._-]{1,128}$/.test(serial) ? serial : null;
}

function validateMappingDocument(document) {
  const errors = [];
  if (!document || Array.isArray(document) || typeof document !== 'object') {
    return { ok: false, errors: ['Mapping file must contain a JSON object.'], mappings: new Map() };
  }
  for (const key of Object.keys(document)) {
    if (!new Set(['version', 'printers']).has(key)) errors.push(`Unsupported root key: ${key}`);
  }
  if (document.version !== 1) errors.push('Mapping version must be 1.');
  if (!document.printers || Array.isArray(document.printers) || typeof document.printers !== 'object') {
    errors.push('printers must be an object keyed by serial number.');
  }

  const mappings = new Map();
  const entries = document.printers && !Array.isArray(document.printers) && typeof document.printers === 'object'
    ? Object.entries(document.printers)
    : [];
  for (const [serialKey, entry] of entries) {
    const serial = normalizeSerial(serialKey);
    if (!serial) {
      errors.push(`Printer serial key is invalid: ${serialKey}`);
      continue;
    }
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') {
      errors.push(`printers.${serialKey} must be an object.`);
      continue;
    }
    for (const key of Object.keys(entry)) {
      if (key !== 'windows') errors.push(`printers.${serialKey} has unsupported key: ${key}`);
    }
    const config = entry.windows;
    if (!config || Array.isArray(config) || typeof config !== 'object') {
      errors.push(`printers.${serialKey}.windows must be an object.`);
      continue;
    }
    for (const key of Object.keys(config)) {
      if (key !== 'queue') errors.push(`printers.${serialKey}.windows has unsupported key: ${key}`);
    }
    const queue = typeof config.queue === 'string' ? config.queue.trim() : '';
    if (!queue || queue.length > 256 || /[\r\n\0]/.test(queue)) {
      errors.push(`printers.${serialKey}.windows.queue is invalid.`);
      continue;
    }
    mappings.set(serial, { serial, queue });
  }
  return { ok: errors.length === 0, errors, mappings };
}

function loadPrinterMappings(options = {}) {
  const filePath = options.filePath || process.env.PRINTER_QUEUE_MAP_FILE || defaultPrinterMappingPath(options.env);
  const fileSystem = options.fs || fs;
  try {
    const document = JSON.parse(fileSystem.readFileSync(filePath, 'utf8'));
    return { filePath, exists: true, ...validateMappingDocument(document) };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { filePath, exists: false, ok: true, errors: [], mappings: new Map() };
    }
    return {
      filePath,
      exists: true,
      ok: false,
      errors: [`Unable to load Windows printer mappings: ${error.message}`],
      mappings: new Map(),
    };
  }
}

function printerSerial(printer) {
  return normalizeSerial(printer?.serial || printer?.serialNumber || printer?.name);
}

function mappingForPrinter(mappingResult, printer) {
  const serial = printerSerial(printer);
  return serial ? mappingResult?.mappings?.get(serial) || null : null;
}

function requireValidMappings(options = {}) {
  const result = loadPrinterMappings(options);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return result;
}

function resolveWindowsPrinterQueue(printer, options = {}) {
  const result = requireValidMappings(options);
  const serial = printerSerial(printer);
  const mapping = mappingForPrinter(result, printer);
  if (!mapping) {
    const suffix = serial ? ` for serial ${serial}` : '';
    throw new Error(
      `No Windows printer queue is configured${suffix}. Add the exact installed queue name to ${result.filePath}`,
    );
  }
  return mapping.queue;
}

function listAssignedWindowsPrinterTargets(printers, options = {}) {
  const result = requireValidMappings(options);
  return printers.flatMap(printer => {
    const mapping = mappingForPrinter(result, printer);
    if (!mapping) return [];
    return [{
      printerId: printer.id,
      name: printer.name,
      ip: printer.ip,
      queue: mapping.queue,
    }];
  });
}

function buildSumatraPrintSettings({ copies, duplex, printOptions }) {
  const settings = [];
  if (printOptions.pageRanges) settings.push(printOptions.pageRanges);
  settings.push(`${copies}x`);
  settings.push(duplex === 'long' ? 'duplexlong' : duplex === 'short' ? 'duplexshort' : 'simplex');
  settings.push(printOptions.orientation === 'landscape' ? 'landscape' : 'portrait');
  settings.push(printOptions.colorMode === 'grayscale' ? 'monochrome' : 'color');
  settings.push(`paper=${printOptions.paperSize.toUpperCase()}`);
  settings.push(printOptions.scale === '100' ? 'noscale' : 'fit');
  return settings.join(',');
}

function validateWindowsPrintOptions(fileName, printOptions) {
  const extension = path.extname(String(fileName || '')).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('Windows printing supports PDF, TXT, JPG, JPEG, and PNG files. Save DOC or DOCX files as PDF before printing.');
  }
  if (printOptions.pagesPerSheet !== 1) {
    throw new Error('Pages per sheet is not supported by the Windows print service. Select 1 page per sheet.');
  }
  if (!['fit', '100'].includes(printOptions.scale)) {
    throw new Error('The Windows print service supports Fit and 100% scale.');
  }
  return extension;
}

function executePrint(command, args, options = {}) {
  const execFileImpl = options.execFileImpl || execFile;
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, {
      timeout: options.timeoutMs || 120_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (!error) return resolve({ stdout, stderr });
      const exitCode = Number(error.code);
      const detail = PRINT_EXIT_MESSAGES.get(exitCode)
        || String(stderr || error.message || 'Windows printing failed').trim();
      reject(new Error(`Windows printing failed: ${detail}`));
    });
  });
}

async function printWindowsBuffer({
  fileBuffer,
  fileName,
  printerName,
  copies,
  duplex,
  printOptions,
}, options = {}) {
  const normalizedPrintOptions = {
    pageRanges: null,
    colorMode: 'color',
    paperSize: 'a4',
    orientation: 'portrait',
    pagesPerSheet: 1,
    quality: 'normal',
    scale: 'fit',
    ...(printOptions || {}),
  };
  const extension = validateWindowsPrintOptions(fileName, normalizedPrintOptions);
  const fileSystem = options.fs || fs;
  const sumatraPath = options.sumatraPath || process.env.SUMATRA_PDF_PATH || defaultSumatraPath(options.env);
  if (!(path.isAbsolute(sumatraPath) || path.win32.isAbsolute(sumatraPath)) || !fileSystem.existsSync(sumatraPath)) {
    throw new Error(`The approved SumatraPDF print engine is missing at ${sumatraPath}`);
  }

  const tempRoot = options.tempRoot || os.tmpdir();
  const tempDir = fileSystem.mkdtempSync(path.join(tempRoot, 'seaoil-print-'));
  const inputPath = path.join(tempDir, `document${extension}`);
  const appDataPath = options.appDataPath || defaultSumatraAppDataPath(options.env);
  try {
    fileSystem.mkdirSync(appDataPath, { recursive: true });
    fileSystem.writeFileSync(inputPath, fileBuffer, { mode: 0o600 });
    const settings = buildSumatraPrintSettings({ copies, duplex, printOptions: normalizedPrintOptions });
    const args = [
      '-silent',
      '-appdata', appDataPath,
      '-print-to', printerName,
      '-print-settings', settings,
      inputPath,
    ];
    await executePrint(sumatraPath, args, options);
    return {
      jobId: `windows-${Date.now()}`,
      message: `Submitted to Windows printer queue ${printerName}`,
    };
  } finally {
    fileSystem.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  buildSumatraPrintSettings,
  defaultPrinterMappingPath,
  defaultSumatraPath,
  listAssignedWindowsPrinterTargets,
  loadPrinterMappings,
  mappingForPrinter,
  printWindowsBuffer,
  resolveWindowsPrinterQueue,
  validateMappingDocument,
  validateWindowsPrintOptions,
};
