'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildScanSettings,
  discoverEsclDevices,
  parseScannerCapabilities,
  runEsclScan,
} = require('./escl-scanner');

const capabilities = `<?xml version="1.0"?>
<scan:ScannerCapabilities xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:MakeAndModel>Brother MFC Test</pwg:MakeAndModel>
  <pwg:SerialNumber>ABC123</pwg:SerialNumber>
  <scan:Platen><scan:PlatenInputCaps /></scan:Platen>
  <scan:Adf><scan:AdfSimplexInputCaps /></scan:Adf>
  <scan:DocumentFormatExt>application/pdf</scan:DocumentFormatExt>
</scan:ScannerCapabilities>`;

test('parses useful eSCL scanner capabilities', () => {
  assert.deepEqual(parseScannerCapabilities(capabilities), {
    model: 'Brother MFC Test',
    serialNumber: 'ABC123',
    formats: ['application/pdf'],
    hasPlaten: true,
    hasAdf: true,
    hasDuplexAdf: false,
  });
});

test('discovers assigned eSCL printers without a SANE installation', async () => {
  const devices = await discoverEsclDevices(
    [{ id: 42, name: 'Finance Printer', ip: '192.0.2.42' }],
    { fetchImpl: async () => new Response(capabilities, { status: 200 }) },
  );
  assert.equal(devices.length, 1);
  assert.equal(devices[0].id, 'escl:42');
  assert.equal(devices[0].printerId, 42);
  assert.equal(devices[0].format, 'application/pdf');
  assert.deepEqual(devices[0].sources, ['Flatbed', 'ADF']);
});

test('creates an eSCL job and downloads its document', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    if (String(url).endsWith('/ScanJobs')) {
      return new Response('', {
        status: 201,
        headers: { location: '/eSCL/ScanJobs/7' },
      });
    }
    return new Response(Buffer.from('%PDF-test'), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
  };
  const result = await runEsclScan({
    id: 'escl:42',
    kind: 'escl',
    baseUrl: 'http://192.0.2.42/eSCL',
    format: 'application/pdf',
    sources: ['Flatbed'],
  }, 'Flatbed', { fetchImpl });

  assert.equal(result.mimeType, 'application/pdf');
  assert.equal(result.extension, 'pdf');
  assert.equal(result.buffer.toString(), '%PDF-test');
  assert.equal(requests[0].url, 'http://192.0.2.42/eSCL/ScanJobs');
  assert.equal(requests[1].url, 'http://192.0.2.42/eSCL/ScanJobs/7/NextDocument');
  assert.match(String(requests[0].init.body), /<pwg:InputSource>Platen<\/pwg:InputSource>/);
});

test('builds feeder and duplex scan settings', () => {
  const xml = buildScanSettings({ source: 'ADF Duplex', format: 'image/jpeg' });
  assert.match(xml, /<pwg:InputSource>Feeder<\/pwg:InputSource>/);
  assert.match(xml, /<scan:Duplex>true<\/scan:Duplex>/);
  assert.match(xml, /<pwg:DocumentFormat>image\/jpeg<\/pwg:DocumentFormat>/);
});
