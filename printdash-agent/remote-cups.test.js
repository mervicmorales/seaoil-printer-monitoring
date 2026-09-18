'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildRemoteCupsJobMessage,
  buildRemoteCupsPrinterTargets,
  listRemoteCupsQueues,
  normalizeCupsServerUrl,
  parsePageRanges,
  printRemoteCupsBuffer,
  printerUrl,
  queueNameForPrinter,
  resolvePrintBackend,
  resolveRemoteCupsPrinterQueue,
} = require('./remote-cups');

function fakeIpp(response, capture = {}) {
  return {
    Printer: class FakePrinter {
      constructor(url, options) {
        capture.url = url;
        capture.options = options;
      }

      execute(operation, message, callback) {
        capture.operation = operation;
        capture.message = message;
        callback(null, response);
      }
    },
  };
}

test('normalizes safe CUPS server URLs and rejects credentials', () => {
  assert.equal(normalizeCupsServerUrl('http://127.0.0.1:631/ignored?q=1'), 'http://127.0.0.1:631');
  assert.throws(() => normalizeCupsServerUrl('ftp://127.0.0.1'), /HTTP or HTTPS/);
  assert.throws(() => normalizeCupsServerUrl('http://user:secret@127.0.0.1:631'), /must not contain credentials/);
});

test('selects safe platform defaults and an explicit remote CUPS backend', () => {
  assert.equal(resolvePrintBackend('', 'win32'), 'windows');
  assert.equal(resolvePrintBackend('', 'linux'), 'cups');
  assert.equal(resolvePrintBackend('remote-cups', 'win32'), 'remote-cups');
  assert.throws(() => resolvePrintBackend('cups', 'win32'), /remote-cups/);
  assert.throws(() => resolvePrintBackend('windows', 'linux'), /only run on Windows/);
});

test('derives only managed queue names from positive printer IDs', () => {
  assert.equal(queueNameForPrinter({ id: 17 }), 'PrintOps_17');
  assert.equal(printerUrl('http://127.0.0.1:631', 'PrintOps_17'), 'http://127.0.0.1:631/printers/PrintOps_17');
  assert.throws(() => queueNameForPrinter(0), /valid numeric ID/);
  assert.throws(() => printerUrl('http://127.0.0.1:631', 'Office Printer'), /managed PrintOps queue/);
});

test('parses IPP page ranges', () => {
  assert.deepEqual(parsePageRanges('1-3,5'), [[1, 3], [5, 5]]);
  assert.equal(parsePageRanges(''), null);
  assert.throws(() => parsePageRanges('3-1'), /ascending order/);
});

test('builds a standards-based IPP job message', () => {
  const message = buildRemoteCupsJobMessage({
    fileBuffer: Buffer.from('%PDF'),
    fileName: 'quarterly.pdf',
    copies: 2,
    duplex: 'long',
    printOptions: {
      pageRanges: '1-3,5',
      colorMode: 'grayscale',
      paperSize: 'legal',
      orientation: 'landscape',
      pagesPerSheet: 2,
      quality: 'high',
      scale: '100',
    },
  });
  assert.equal(message['operation-attributes-tag']['document-format'], 'application/pdf');
  assert.deepEqual(message['job-attributes-tag'], {
    copies: 2,
    sides: 'two-sided-long-edge',
    media: 'na_legal_8.5x14in',
    'orientation-requested': 'landscape',
    'number-up': 2,
    'print-quality': 'high',
    'print-color-mode': 'monochrome',
    'print-scaling': 'none',
    'page-ranges': [[1, 3], [5, 5]],
  });
  assert.ok(Buffer.isBuffer(message.data));
});

test('uses safe defaults when the legacy local endpoint omits print options', () => {
  const message = buildRemoteCupsJobMessage({
    fileBuffer: Buffer.from('pdf'),
    fileName: 'report.pdf',
    copies: 1,
    duplex: 'none',
  });
  assert.equal(message['job-attributes-tag'].media, 'iso_a4_210x297mm');
  assert.equal(message['job-attributes-tag']['number-up'], 1);
  assert.equal(message['job-attributes-tag']['print-scaling'], 'fit');
});

test('rejects unsupported office documents and fractional scaling', () => {
  assert.throws(() => buildRemoteCupsJobMessage({
    fileName: 'document.docx',
    printOptions: {},
  }), /Save DOC or DOCX files as PDF/);
  assert.throws(() => buildRemoteCupsJobMessage({
    fileName: 'document.pdf',
    printOptions: { scale: '75' },
  }), /supports Fit and 100%/);
});

test('lists managed queues returned by CUPS', async () => {
  const capture = {};
  const queues = await listRemoteCupsQueues({
    ippModule: fakeIpp({
      statusCode: 'successful-ok',
      'printer-attributes-tag': [
        {
          'printer-name': 'PrintOps_17',
          'printer-uri-supported': 'ipp://127.0.0.1:631/printers/PrintOps_17',
          'printer-state': 'idle',
          'printer-is-accepting-jobs': true,
          'printer-state-reasons': 'none',
        },
        { 'printer-name': 'Unmanaged', 'printer-is-accepting-jobs': true },
      ],
    }, capture),
  });
  assert.equal(capture.operation, 'CUPS-Get-Printers');
  assert.deepEqual(queues.map(queue => queue.name), ['PrintOps_17']);
  assert.equal(queues[0].accepting, true);
});

test('maps central printer IDs only to accepting CUPS queues', () => {
  const targets = buildRemoteCupsPrinterTargets([
    { id: 17, name: 'Brother L3750', ip: '172.16.8.66' },
    { id: 19, name: 'Brother T4500', ip: '172.16.8.41' },
  ], [
    { name: 'PrintOps_17', accepting: true, state: 'idle' },
    { name: 'PrintOps_19', accepting: false, state: 'stopped' },
  ]);
  assert.deepEqual(targets, [{
    printerId: 17,
    name: 'Brother L3750',
    ip: '172.16.8.66',
    queue: 'PrintOps_17',
    state: 'idle',
  }]);
});

test('reports a missing deterministic queue instead of creating one', async () => {
  await assert.rejects(resolveRemoteCupsPrinterQueue({ id: 19 }, {
    ippModule: fakeIpp({ statusCode: 'successful-ok', 'printer-attributes-tag': [] }),
  }), /PrintOps_19 is not configured/);
});

test('submits a print job and returns the CUPS job ID', async () => {
  const capture = {};
  const result = await printRemoteCupsBuffer({
    fileBuffer: Buffer.from('%PDF'),
    fileName: 'test.pdf',
    printerName: 'PrintOps_3',
    copies: 1,
    duplex: 'none',
    printOptions: { paperSize: 'a4', scale: 'fit' },
  }, {
    ippModule: fakeIpp({
      statusCode: 'successful-ok',
      'job-attributes-tag': { 'job-id': 42, 'job-uri': 'ipp://127.0.0.1/jobs/42' },
    }, capture),
  });
  assert.equal(capture.operation, 'Print-Job');
  assert.equal(capture.url, 'http://127.0.0.1:631/printers/PrintOps_3');
  assert.equal(result.jobId, 42);
  assert.match(result.message, /PrintOps_3/);
});

test('rejects unsuccessful IPP responses', async () => {
  await assert.rejects(listRemoteCupsQueues({
    ippModule: fakeIpp({ statusCode: 'server-error-service-unavailable' }),
  }), /CUPS-Get-Printers failed/);
});
