'use strict';

const path = require('path');
const ipp = require('@sealsystems/ipp');

const DEFAULT_CUPS_SERVER_URL = 'http://127.0.0.1:631';
const DEFAULT_TIMEOUT_MS = 10_000;
const QUEUE_NAME_PATTERN = /^PrintOps_([1-9]\d*)$/;
const DOCUMENT_FORMATS = new Map([
  ['.pdf', 'application/pdf'],
  ['.txt', 'text/plain'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
]);
const MEDIA_BY_PAPER_SIZE = new Map([
  ['a4', 'iso_a4_210x297mm'],
  ['letter', 'na_letter_8.5x11in'],
  ['legal', 'na_legal_8.5x14in'],
  ['a3', 'iso_a3_297x420mm'],
]);

function resolvePrintBackend(value, platform = process.platform) {
  const configured = String(value || '').trim().toLowerCase();
  const backend = configured || (platform === 'win32' ? 'windows' : 'cups');
  if (!['cups', 'windows', 'remote-cups'].includes(backend)) {
    throw new Error('PRINT_BACKEND must be cups, windows, or remote-cups');
  }
  if (backend === 'windows' && platform !== 'win32') {
    throw new Error('The Windows print backend can only run on Windows');
  }
  if (backend === 'cups' && platform === 'win32') {
    throw new Error('Use PRINT_BACKEND=remote-cups to reach CUPS from Windows');
  }
  return backend;
}

function normalizeCupsServerUrl(value = process.env.CUPS_SERVER_URL || DEFAULT_CUPS_SERVER_URL) {
  let parsed;
  try {
    parsed = new URL(String(value || DEFAULT_CUPS_SERVER_URL).trim());
  } catch {
    throw new Error('CUPS_SERVER_URL must be a valid HTTP or HTTPS URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('CUPS_SERVER_URL must use HTTP or HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new Error('CUPS_SERVER_URL must not contain credentials');
  }
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = '/';
  return parsed.toString().replace(/\/$/, '');
}

function queueNameForPrinter(printerOrId) {
  const rawId = typeof printerOrId === 'object' && printerOrId !== null
    ? printerOrId.id
    : printerOrId;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error('The selected printer has no valid numeric ID');
  }
  return `PrintOps_${id}`;
}

function assertQueueName(queueName) {
  const normalized = String(queueName || '').trim();
  if (!QUEUE_NAME_PATTERN.test(normalized)) {
    throw new Error('The selected CUPS queue is not a managed PrintOps queue');
  }
  return normalized;
}

function printerUrl(serverUrl, queueName) {
  const normalizedServer = normalizeCupsServerUrl(serverUrl);
  const normalizedQueue = assertQueueName(queueName);
  return `${normalizedServer}/printers/${encodeURIComponent(normalizedQueue)}`;
}

function successfulResponse(response) {
  return String(response?.statusCode || '').startsWith('successful-');
}

function responseError(operation, response) {
  const status = response?.statusCode || 'unknown IPP status';
  const message = response?.['operation-attributes-tag']?.['status-message'];
  return new Error(`${operation} failed: ${status}${message ? ` (${message})` : ''}`);
}

function executeIpp(url, operation, message, options = {}) {
  const ippModule = options.ippModule || ipp;
  const timeout = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const client = new ippModule.Printer(url, { timeout, closeTimeout: timeout });
    client.execute(operation, message, (error, response) => {
      if (error) return reject(new Error(`${operation} could not reach CUPS: ${error.message}`));
      if (!successfulResponse(response)) return reject(responseError(operation, response));
      resolve(response);
    });
  });
}

function normalizePrinterAttributeGroups(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function listRemoteCupsQueues(options = {}) {
  const serverUrl = normalizeCupsServerUrl(options.serverUrl);
  const response = await executeIpp(serverUrl, 'CUPS-Get-Printers', {
    'operation-attributes-tag': {
      'requesting-user-name': 'seaoil-agent',
      'requested-attributes': [
        'printer-name',
        'printer-uri-supported',
        'printer-state',
        'printer-is-accepting-jobs',
        'printer-state-reasons',
      ],
    },
  }, options);

  return normalizePrinterAttributeGroups(response['printer-attributes-tag'])
    .map(attributes => ({
      name: String(attributes['printer-name'] || '').trim(),
      uri: String(attributes['printer-uri-supported'] || '').trim(),
      state: String(attributes['printer-state'] || 'unknown'),
      accepting: attributes['printer-is-accepting-jobs'] === true,
      reasons: Array.isArray(attributes['printer-state-reasons'])
        ? attributes['printer-state-reasons'].map(String)
        : [String(attributes['printer-state-reasons'] || 'none')],
    }))
    .filter(queue => QUEUE_NAME_PATTERN.test(queue.name));
}

function buildRemoteCupsPrinterTargets(printers, queues) {
  const availableQueues = new Map(
    (queues || [])
      .filter(queue => queue.accepting)
      .map(queue => [queue.name, queue]),
  );
  return (printers || []).flatMap(printer => {
    let queueName;
    try {
      queueName = queueNameForPrinter(printer);
    } catch {
      return [];
    }
    const queue = availableQueues.get(queueName);
    if (!queue) return [];
    return [{
      printerId: printer.id,
      name: printer.name,
      ip: printer.ip,
      queue: queue.name,
      state: queue.state,
    }];
  });
}

async function listAssignedRemoteCupsPrinterTargets(printers, options = {}) {
  const queues = await listRemoteCupsQueues(options);
  return buildRemoteCupsPrinterTargets(printers, queues);
}

async function resolveRemoteCupsPrinterQueue(printer, options = {}) {
  const expectedQueue = queueNameForPrinter(printer);
  const queues = await listRemoteCupsQueues(options);
  const match = queues.find(queue => queue.name === expectedQueue);
  if (!match) {
    throw new Error(`CUPS queue ${expectedQueue} is not configured for the selected printer`);
  }
  if (!match.accepting) {
    throw new Error(`CUPS queue ${expectedQueue} is not accepting print jobs`);
  }
  return expectedQueue;
}

function parsePageRanges(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(text)) {
    throw new Error('Page ranges must look like 1-3,5');
  }
  return text.split(',').map(part => {
    const [firstText, lastText = firstText] = part.split('-');
    const first = Number(firstText);
    const last = Number(lastText);
    if (first < 1 || last < first) throw new Error('Page ranges must be in ascending order');
    return [first, last];
  });
}

function remoteDocumentFormat(fileName) {
  const extension = path.extname(String(fileName || '')).toLowerCase();
  const format = DOCUMENT_FORMATS.get(extension);
  if (!format) {
    throw new Error('CUPS printing supports PDF, TXT, JPG, JPEG, and PNG files. Save DOC or DOCX files as PDF before printing.');
  }
  return format;
}

function safeJobName(fileName) {
  const base = path.basename(String(fileName || 'PrintOps document'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return (base || 'PrintOps document').slice(0, 120);
}

function buildRemoteCupsJobMessage({ fileBuffer, fileName, copies, duplex, printOptions = {}, includeData = true }) {
  const normalizedCopies = Number(copies || 1);
  if (!Number.isInteger(normalizedCopies) || normalizedCopies < 1 || normalizedCopies > 99) {
    throw new Error('Copies must be from 1 to 99');
  }
  const normalizedDuplex = ['none', 'long', 'short'].includes(duplex) ? duplex : 'none';
  const paperSize = String(printOptions.paperSize || 'a4').toLowerCase();
  const media = MEDIA_BY_PAPER_SIZE.get(paperSize);
  if (!media) throw new Error('The selected paper size is not supported');
  const scale = String(printOptions.scale || 'fit');
  if (!['fit', '100'].includes(scale)) {
    throw new Error('Remote CUPS printing supports Fit and 100% scale.');
  }
  const pagesPerSheet = Number(printOptions.pagesPerSheet || 1);
  if (![1, 2, 4, 6, 9, 16].includes(pagesPerSheet)) {
    throw new Error('The selected pages-per-sheet value is not supported');
  }

  const message = {
    'operation-attributes-tag': {
      'requesting-user-name': 'seaoil-agent',
      'job-name': safeJobName(fileName),
      'document-format': remoteDocumentFormat(fileName),
    },
    'job-attributes-tag': {
      copies: normalizedCopies,
      sides: normalizedDuplex === 'long'
        ? 'two-sided-long-edge'
        : normalizedDuplex === 'short'
          ? 'two-sided-short-edge'
          : 'one-sided',
      media,
      'orientation-requested': printOptions.orientation === 'landscape' ? 'landscape' : 'portrait',
      'number-up': pagesPerSheet,
      'print-quality': ['draft', 'normal', 'high'].includes(printOptions.quality)
        ? printOptions.quality
        : 'normal',
      'print-color-mode': printOptions.colorMode === 'grayscale' ? 'monochrome' : 'color',
      'print-scaling': scale === '100' ? 'none' : 'fit',
    },
  };
  const pageRanges = parsePageRanges(printOptions.pageRanges);
  if (pageRanges) message['job-attributes-tag']['page-ranges'] = pageRanges;
  if (includeData) message.data = fileBuffer;
  return message;
}

async function validateRemoteCupsJob({ fileName, printerName, copies = 1, duplex = 'none', printOptions }, options = {}) {
  const url = printerUrl(options.serverUrl, printerName);
  const message = buildRemoteCupsJobMessage({
    fileName,
    copies,
    duplex,
    printOptions,
    includeData: false,
  });
  return executeIpp(url, 'Validate-Job', message, options);
}

async function printRemoteCupsBuffer({
  fileBuffer,
  fileName,
  printerName,
  copies = 1,
  duplex = 'none',
  printOptions,
}, options = {}) {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error('The print file is empty');
  }
  const queueName = assertQueueName(printerName);
  const url = printerUrl(options.serverUrl, queueName);
  const message = buildRemoteCupsJobMessage({
    fileBuffer,
    fileName,
    copies,
    duplex,
    printOptions,
  });
  const response = await executeIpp(url, 'Print-Job', message, options);
  const jobAttributes = response['job-attributes-tag'] || {};
  return {
    jobId: jobAttributes['job-id'] ?? null,
    jobUri: jobAttributes['job-uri'] || null,
    message: `Submitted to CUPS queue ${queueName}`,
  };
}

module.exports = {
  DEFAULT_CUPS_SERVER_URL,
  assertQueueName,
  buildRemoteCupsJobMessage,
  buildRemoteCupsPrinterTargets,
  listAssignedRemoteCupsPrinterTargets,
  listRemoteCupsQueues,
  normalizeCupsServerUrl,
  parsePageRanges,
  printRemoteCupsBuffer,
  printerUrl,
  queueNameForPrinter,
  remoteDocumentFormat,
  resolvePrintBackend,
  resolveRemoteCupsPrinterQueue,
  validateRemoteCupsJob,
};
