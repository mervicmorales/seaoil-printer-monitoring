'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildScanSettings,
  detectScanMimeType,
  discoverEsclDevices,
  parseScannerCapabilities,
  runEsclScan,
} = require('./escl-scanner');

const capabilities = `<?xml version="1.0"?>
<scan:ScannerCapabilities xmlns:scan="http://schemas.hp.com/imaging/escl/2011/05/03" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>2.0</pwg:Version>
  <pwg:MakeAndModel>Brother MFC Test</pwg:MakeAndModel>
  <pwg:SerialNumber>ABC123</pwg:SerialNumber>
  <scan:Platen><scan:PlatenInputCaps /></scan:Platen>
  <scan:Adf><scan:AdfSimplexInputCaps /></scan:Adf>
  <scan:DocumentFormatExt>application/pdf</scan:DocumentFormatExt>
</scan:ScannerCapabilities>`;

const legacyHpCapabilities = `<?xml version="1.0"?>
<scan:ScannerCapabilities xmlns:scan="http://schemas.hp.com/imaging/escl/2011/02/08" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>1.0</pwg:Version>
  <pwg:MakeAndModel>HP LaserJet Pro MFP M225dn</pwg:MakeAndModel>
  <scan:ColorProfile>
    <scan:ColorReference>RGB24</scan:ColorReference>
    <scan:Formats><pwg:DocumentFormat>image/jpeg</pwg:DocumentFormat></scan:Formats>
  </scan:ColorProfile>
  <scan:Platen>
    <scan:PlatenInputCaps>
      <scan:MaxWidth>2550</scan:MaxWidth>
      <scan:MaxHeight>3508</scan:MaxHeight>
      <scan:XResolution>200</scan:XResolution>
      <scan:XResolution>300</scan:XResolution>
    </scan:PlatenInputCaps>
  </scan:Platen>
</scan:ScannerCapabilities>`;

test('parses useful eSCL scanner capabilities', () => {
  const parsed = parseScannerCapabilities(capabilities);
  assert.equal(parsed.model, 'Brother MFC Test');
  assert.equal(parsed.serialNumber, 'ABC123');
  assert.deepEqual(parsed.formats, ['application/pdf']);
  assert.equal(parsed.hasPlaten, true);
  assert.equal(parsed.hasAdf, true);
  assert.equal(parsed.hasDuplexAdf, false);
  assert.equal(parsed.scanSettings.namespace, 'http://schemas.hp.com/imaging/escl/2011/05/03');
  assert.equal(parsed.scanSettings.version, '2.0');
  assert.equal(parsed.scanSettings.supportsDocumentFormatExt, true);
});

test('builds a capability-aware scan ticket for a legacy HP CloudScan device', () => {
  const parsed = parseScannerCapabilities(legacyHpCapabilities);
  const xml = buildScanSettings({
    source: 'Flatbed',
    format: 'image/jpeg',
    settings: parsed.scanSettings,
  });

  assert.equal(parsed.scanSettings.version, '1.0');
  assert.equal(parsed.scanSettings.supportsDocumentFormatExt, false);
  assert.match(xml, /xmlns:scan="http:\/\/schemas\.hp\.com\/imaging\/escl\/2011\/02\/08"/);
  assert.match(xml, /<pwg:Version>1\.0<\/pwg:Version>/);
  assert.match(xml, /<pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches<\/pwg:ContentRegionUnits>/);
  assert.match(xml, /<pwg:Width>2550<\/pwg:Width>/);
  assert.match(xml, /<pwg:Height>3508<\/pwg:Height>/);
  assert.match(xml, /<scan:XResolution>300<\/scan:XResolution>/);
  assert.doesNotMatch(xml, /DocumentFormatExt/);
  assert.doesNotMatch(xml, /<scan:Intent>/);
  assert.ok(xml.indexOf('<pwg:DocumentFormat>') < xml.indexOf('<scan:XResolution>'));
});

test('keeps modern Brother and Canon eSCL options in their scan ticket', () => {
  const parsed = parseScannerCapabilities(capabilities);
  const xml = buildScanSettings({
    source: 'Flatbed',
    format: 'application/pdf',
    settings: parsed.scanSettings,
  });

  assert.match(xml, /xmlns:scan="http:\/\/schemas\.hp\.com\/imaging\/escl\/2011\/05\/03"/);
  assert.match(xml, /<pwg:Version>2\.0<\/pwg:Version>/);
  assert.match(xml, /<scan:DocumentFormatExt>application\/pdf<\/scan:DocumentFormatExt>/);
  assert.match(xml, /<pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches<\/pwg:ContentRegionUnits>/);
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

test('retries scanner discovery when a sleeping printer misses the first request', async () => {
  let requests = 0;
  const devices = await discoverEsclDevices(
    [{ id: 43, name: 'Sleeping Office Printer', ip: '192.0.2.43' }],
    {
      fetchImpl: async () => {
        requests += 1;
        if (requests === 1) throw new Error('temporary connection failure');
        return new Response(capabilities, { status: 200 });
      },
    },
  );
  assert.equal(requests, 2);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].printerId, 43);
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

test('uses the returned JPEG signature when a scanner advertises PDF', async () => {
  const fetchImpl = async url => {
    if (String(url).endsWith('/ScanJobs')) {
      return new Response('', {
        status: 201,
        headers: { location: '/eSCL/ScanJobs/8' },
      });
    }
    return new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
  };
  const result = await runEsclScan({
    id: 'escl:45',
    kind: 'escl',
    baseUrl: 'http://192.0.2.45/eSCL',
    format: 'application/pdf',
    sources: ['Flatbed'],
  }, 'Flatbed', { fetchImpl });

  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.extension, 'jpg');
});

test('detects supported scan formats from their file signatures', () => {
  assert.equal(detectScanMimeType(Buffer.from('%PDF-test')), 'application/pdf');
  assert.equal(detectScanMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(
    detectScanMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/png',
  );
  assert.equal(detectScanMimeType(Buffer.from('unknown')), null);
});

test('builds feeder and duplex scan settings', () => {
  const xml = buildScanSettings({ source: 'ADF Duplex', format: 'image/jpeg' });
  assert.match(xml, /<pwg:InputSource>Feeder<\/pwg:InputSource>/);
  assert.match(xml, /<scan:Duplex>true<\/scan:Duplex>/);
  assert.match(xml, /<pwg:DocumentFormat>image\/jpeg<\/pwg:DocumentFormat>/);
});
