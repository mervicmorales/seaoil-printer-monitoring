'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  buildSumatraPrintSettings,
  listAssignedWindowsPrinterTargets,
  mappingForPrinter,
  printWindowsBuffer,
  resolveWindowsPrinterQueue,
  validateMappingDocument,
  validateWindowsPrintOptions,
} = require('./windows-printer');

function mappingDocument() {
  return {
    version: 1,
    printers: {
      ABC123: { windows: { queue: 'Office HP Queue' } },
    },
  };
}

function standardOptions(overrides = {}) {
  return {
    pageRanges: null,
    colorMode: 'color',
    paperSize: 'a4',
    orientation: 'portrait',
    pagesPerSheet: 1,
    quality: 'normal',
    scale: 'fit',
    ...overrides,
  };
}

test('validates Windows queue mappings and matches serial numbers case-insensitively', () => {
  const result = validateMappingDocument(mappingDocument());
  assert.equal(result.ok, true);
  assert.equal(mappingForPrinter(result, { serial: 'abc123' }).queue, 'Office HP Queue');
});

test('rejects malformed or unexpected mapping fields', () => {
  const document = mappingDocument();
  document.printers.ABC123.windows.command = 'unsafe.exe';
  const result = validateMappingDocument(document);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unsupported key/);
});

test('lists and resolves only explicitly mapped assigned printers', () => {
  const fileSystem = {
    readFileSync: () => JSON.stringify(mappingDocument()),
  };
  const printers = [
    { id: 3, name: 'ABC123', serial: 'ABC123', ip: '192.0.2.10' },
    { id: 4, name: 'UNMAPPED', serial: 'UNMAPPED', ip: '192.0.2.11' },
  ];
  assert.equal(resolveWindowsPrinterQueue(printers[0], { fs: fileSystem, filePath: 'map.json' }), 'Office HP Queue');
  assert.deepEqual(listAssignedWindowsPrinterTargets(printers, { fs: fileSystem, filePath: 'map.json' }), [{
    printerId: 3,
    name: 'ABC123',
    ip: '192.0.2.10',
    queue: 'Office HP Queue',
  }]);
  assert.throws(
    () => resolveWindowsPrinterQueue(printers[1], { fs: fileSystem, filePath: 'map.json' }),
    /No Windows printer queue is configured/,
  );
});

test('builds allowlisted SumatraPDF settings for normal portal options', () => {
  assert.equal(buildSumatraPrintSettings({
    copies: 2,
    duplex: 'long',
    printOptions: standardOptions({
      pageRanges: '1-3,5',
      colorMode: 'grayscale',
      paperSize: 'letter',
      orientation: 'landscape',
      scale: '100',
    }),
  }), '1-3,5,2x,duplexlong,landscape,monochrome,paper=LETTER,noscale');
});

test('rejects formats and settings the Windows engine cannot honor', () => {
  assert.throws(() => validateWindowsPrintOptions('document.docx', standardOptions()), /Save DOC or DOCX files as PDF/);
  assert.throws(() => validateWindowsPrintOptions('document.pdf', standardOptions({ pagesPerSheet: 2 })), /Pages per sheet/);
  assert.throws(() => validateWindowsPrintOptions('document.pdf', standardOptions({ scale: '75' })), /Fit and 100%/);
});

test('submits a file with fixed arguments and removes the temporary copy', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seaoil-print-test-'));
  const executable = path.join(tempRoot, 'SumatraPDF.exe');
  fs.writeFileSync(executable, 'test');
  const calls = [];
  try {
    const result = await printWindowsBuffer({
      fileBuffer: Buffer.from('%PDF-test'),
      fileName: 'report.pdf',
      printerName: 'Office HP Queue',
      copies: 1,
      duplex: 'none',
      printOptions: standardOptions(),
    }, {
      sumatraPath: executable,
      appDataPath: path.join(tempRoot, 'appdata'),
      tempRoot,
      execFileImpl: (command, args, options, callback) => {
        calls.push({ command, args, options });
        callback(null, '', '');
      },
    });
    assert.match(result.jobId, /^windows-/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, executable);
    assert.deepEqual(calls[0].args.slice(0, 7), [
      '-silent', '-appdata', path.join(tempRoot, 'appdata'), '-print-to', 'Office HP Queue', '-print-settings',
      '1x,simplex,portrait,color,paper=A4,fit',
    ]);
    assert.equal(fs.existsSync(calls[0].args.at(-1)), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('uses safe defaults when the legacy local endpoint omits print options', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seaoil-print-defaults-test-'));
  const executable = path.join(tempRoot, 'SumatraPDF.exe');
  fs.writeFileSync(executable, 'test');
  const calls = [];
  try {
    await printWindowsBuffer({
      fileBuffer: Buffer.from('pdf'),
      fileName: 'report.pdf',
      printerName: 'Office Queue',
      copies: 1,
      duplex: 'none',
    }, {
      sumatraPath: executable,
      tempRoot,
      appDataPath: path.join(tempRoot, 'appdata'),
      execFileImpl(command, args, execOptions, callback) {
        calls.push({ command, args, execOptions });
        callback(null, '', '');
      },
    });
    const settingsIndex = calls[0].args.indexOf('-print-settings');
    assert.equal(calls[0].args[settingsIndex + 1], '1x,simplex,portrait,color,paper=A4,fit');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
