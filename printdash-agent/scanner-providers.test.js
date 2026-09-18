'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  buildScanArgs,
  createNaps2Provider,
  resolveNaps2Command,
  runProcess,
  safeDiagnostic,
} = require('./scanner-providers/naps2-scanner');
const {
  DEFAULT_MAX_SCAN_BYTES,
  detectScanFormat,
  resolveContainedPath,
  validateScanBuffer,
} = require('./scanner-providers/scan-output');
const { parseSaneDeviceList } = require('./scanner-providers/sane-scanner');
const { mappingForSerial, validateMappingDocument } = require('./scanner-providers/scanner-mapping');

function mappingDocument(driver = 'wia') {
  return {
    version: 1,
    scanners: {
      ABC123: {
        windows: { provider: 'naps2', driver, device: 'Office Scanner ABC123' },
        macos: { provider: 'naps2', driver: 'apple', device: 'Office Scanner ABC123' },
      },
    },
  };
}

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => { child.emit('close', null, 'SIGTERM'); return true; };
  return child;
}

test('validates mappings and matches serial numbers case-insensitively', () => {
  const result = validateMappingDocument(mappingDocument(), 'win32');
  assert.equal(result.ok, true);
  assert.equal(mappingForSerial(result, 'abc123').device, 'Office Scanner ABC123');
});

test('rejects unsupported native scanner drivers', () => {
  const result = validateMappingDocument(mappingDocument('escl'), 'win32');
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /not supported/);
});

test('resolves fixed Windows and macOS NAPS2 console commands', () => {
  assert.deepEqual(resolveNaps2Command({ platform: 'win32' }), {
    command: 'C:\\Program Files\\NAPS2\\NAPS2.Console.exe', prefixArgs: [],
  });
  assert.deepEqual(resolveNaps2Command({ platform: 'darwin' }), {
    command: '/Applications/NAPS2.app/Contents/MacOS/NAPS2', prefixArgs: ['console'],
  });
  assert.throws(() => resolveNaps2Command({ platform: 'win32', override: 'relative.exe' }), /absolute path/);
});

test('builds allowlisted NAPS2 arguments and maps all sources', () => {
  const mapping = { driver: 'wia', device: 'Office Scanner' };
  assert.deepEqual(buildScanArgs(mapping, 'C:\\safe\\scan.pdf', { source: 'flatbed' }).slice(0, 8),
    ['--noprofile', '--driver', 'wia', '--device', 'Office Scanner', '--source', 'glass', '--dpi']);
  assert.equal(buildScanArgs(mapping, 'C:\\safe\\scan.pdf', { source: 'adf' })[6], 'feeder');
  assert.equal(buildScanArgs(mapping, 'C:\\safe\\scan.pdf', { source: 'adf-duplex' })[6], 'duplex');
});

test('detects PDF, JPEG, and PNG signatures and rejects incomplete PDF', () => {
  assert.equal(detectScanFormat(Buffer.from('%PDF-1.7\ndata\n%%EOF\n')).mimeType, 'application/pdf');
  assert.equal(detectScanFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).mimeType, 'image/jpeg');
  assert.equal(detectScanFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).mimeType, 'image/png');
  assert.throws(() => validateScanBuffer(Buffer.from('%PDF-1.7\nincomplete')), /incomplete/);
});

test('enforces output size and path containment', () => {
  assert.throws(() => validateScanBuffer(Buffer.alloc(DEFAULT_MAX_SCAN_BYTES + 1)), /safety limit/);
  const root = path.join(os.tmpdir(), 'seaoil-scans');
  assert.throws(() => resolveContainedPath(root, path.join(root, '..', 'outside.pdf')), /inside/);
  assert.equal(resolveContainedPath(root, path.join(root, 'inside.pdf')), path.resolve(root, 'inside.pdf'));
});

test('reports non-zero NAPS2 exits and redacts sensitive diagnostics', async () => {
  const spawn = () => {
    const child = fakeChild();
    queueMicrotask(() => { child.stderr.emit('data', 'token=private-value'); child.emit('close', 2, null); });
    return child;
  };
  await assert.rejects(runProcess('naps2', [], { spawn }), /token=\[redacted\]/);
  assert.equal(safeDiagnostic('password=hunter2'), 'password=[redacted]');
});

test('times out NAPS2 and terminates the child', async () => {
  let killed = false;
  const spawn = () => {
    const child = fakeChild();
    child.kill = () => { killed = true; return true; };
    return child;
  };
  await assert.rejects(runProcess('naps2', [], { spawn, timeoutMs: 5 }), /timed out/);
  assert.equal(killed, true);
});

test('missing NAPS2 executable is a non-fatal diagnostic', async () => {
  const provider = createNaps2Provider({
    platform: 'win32', scanDirectory: os.tmpdir(),
    fs: { promises: { access: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); } } },
  });
  assert.deepEqual(await provider.diagnostics(['wia']), {
    available: false,
    command: 'C:\\Program Files\\NAPS2\\NAPS2.Console.exe',
    version: null,
    devices: {},
  });
});

test('prevents concurrent scans and kills an active child during shutdown', async () => {
  let child;
  const spawn = () => (child = fakeChild());
  const provider = createNaps2Provider({
    platform: 'win32', scanDirectory: os.tmpdir(), spawn,
    fs: { promises: { access: async () => {} } },
  });
  const mapping = { driver: 'wia', device: 'Office Scanner' };
  const first = provider.scan(mapping).then(() => null, (error) => error);
  await assert.rejects(provider.scan(mapping), /already processing/);
  await provider.shutdown();
  assert.match((await first).message, /failed/);
  assert.ok(child);
});

test('keeps SANE discovery backward compatible', () => {
  const devices = parseSaneDeviceList("device `airscan:e0:Brother' is a Brother MFP", () => 12);
  assert.equal(devices[0].kind, 'sane');
  assert.equal(devices[0].backendId, 'airscan:e0:Brother');
  assert.equal(devices[0].printerId, 12);
});
