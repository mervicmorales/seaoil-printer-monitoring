'use strict';

const net = require('net');
const http = require('http');
const https = require('https');

const CAPABILITY_TIMEOUT_MS = 10_000;
const CREATE_JOB_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_SCAN_BYTES = 24 * 1024 * 1024;
const DISCOVERY_ATTEMPTS = 2;
const DISCOVERY_RETRY_DELAY_MS = 500;
const MODERN_ESCL_NAMESPACE = 'http://schemas.hp.com/imaging/escl/2011/05/03';
const LEGACY_HP_SCAN_NAMESPACE = 'http://schemas.hp.com/imaging/escl/2011/02/08';
const SUPPORTED_COLOR_MODES = new Set(['RGB24', 'Grayscale8', 'BlackAndWhite1']);

async function discoverEsclDevices(printers, options = {}) {
  const request = requestFor(options.fetchImpl);
  const timeoutMs = Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : CAPABILITY_TIMEOUT_MS;
  const candidates = printers.filter(printer =>
    Number.isSafeInteger(Number(printer.id)) && net.isIP(String(printer.ip || '').trim()) !== 0,
  );
  const results = await Promise.all(candidates.map(async printer => {
    const ip = String(printer.ip).trim();
    for (let attempt = 0; attempt < DISCOVERY_ATTEMPTS; attempt += 1) {
      const baseUrl = `http://${ip}/eSCL`;
      try {
        const response = await request(
          `${baseUrl}/ScannerCapabilities`,
          { headers: { Accept: 'text/xml, application/xml' } },
          timeoutMs,
        );
        if (!response.ok) continue;
        const capabilities = parseScannerCapabilities(await response.text());
        if (!capabilities.hasPlaten && !capabilities.hasAdf) return null;
        const printerLabel = printer.name || capabilities.model || `Scanner ${ip}`;
        const detail = capabilities.model && capabilities.model !== printerLabel
          ? ` · ${capabilities.model}`
          : '';
        return {
          id: `escl:${Number(printer.id)}`,
          label: `${printerLabel}${detail} · ${ip}`,
          kind: 'escl',
          printerId: Number(printer.id),
          baseUrl,
          format: capabilities.formats.includes('application/pdf')
            ? 'application/pdf'
            : 'image/jpeg',
          scanSettings: capabilities.scanSettings,
          sources: [
            ...(capabilities.hasPlaten ? ['Flatbed'] : []),
            ...(capabilities.hasAdf ? ['ADF'] : []),
            ...(capabilities.hasDuplexAdf ? ['ADF Duplex'] : []),
          ],
        };
      } catch {
        // Sleeping network MFPs commonly fail their first capability request.
      }
      if (attempt + 1 < DISCOVERY_ATTEMPTS) {
        await delay(DISCOVERY_RETRY_DELAY_MS);
      }
    }
    return null;
  }));
  return results.filter(Boolean);
}

function parseScannerCapabilities(xml) {
  const model = xmlValue(xml, 'MakeAndModel');
  const serialNumber = xmlValue(xml, 'SerialNumber');
  const formatMatches = Array.from(xml.matchAll(
    /<(?:[A-Za-z0-9_-]+:)?(DocumentFormat|DocumentFormatExt)\b[^>]*>([^<]+)</gi,
  ));
  const formats = formatMatches.map(match => decodeXml(match[2].trim()).toLowerCase());
  const advertisedNamespace = xml.match(/xmlns:scan=["']([^"']+)["']/i)?.[1];
  const scanNamespace = advertisedNamespace === LEGACY_HP_SCAN_NAMESPACE
    ? LEGACY_HP_SCAN_NAMESPACE
    : MODERN_ESCL_NAMESPACE;
  const advertisedVersion = xmlValue(xml, 'Version');
  const version = /^\d+(?:\.\d+)?$/.test(advertisedVersion || '')
    ? advertisedVersion
    : '2.0';
  const colorModes = Array.from(xml.matchAll(
    /<(?:[A-Za-z0-9_-]+:)?(?:ColorMode|ColorReference)\b[^>]*>([^<]+)</gi,
  )).map(match => decodeXml(match[1].trim()));
  const intents = Array.from(xml.matchAll(
    /<(?:[A-Za-z0-9_-]+:)?(?:SupportedIntent|Intent)\b[^>]*>([^<]+)</gi,
  )).map(match => decodeXml(match[1].trim()));
  const platen = parseInputCapabilities(xmlBlock(xml, 'PlatenInputCaps'));
  const adf = parseInputCapabilities(xmlBlock(xml, 'AdfSimplexInputCaps'));
  const adfDuplex = parseInputCapabilities(xmlBlock(xml, 'AdfDuplexInputCaps'));
  return {
    model,
    serialNumber,
    formats: Array.from(new Set(formats)),
    hasPlaten: /<(?:[A-Za-z0-9_-]+:)?Platen\b/i.test(xml),
    hasAdf: /<(?:[A-Za-z0-9_-]+:)?Adf\b/i.test(xml),
    hasDuplexAdf: /<(?:[A-Za-z0-9_-]+:)?AdfDuplexInputCaps\b/i.test(xml),
    scanSettings: {
      namespace: scanNamespace,
      version,
      supportsDocumentFormatExt: formatMatches.some(match => (
        match[1].toLowerCase() === 'documentformatext'
      )),
      supportsDocumentIntent: intents.includes('Document'),
      colorMode: colorModes.find(mode => SUPPORTED_COLOR_MODES.has(mode)) || 'RGB24',
      sources: {
        Flatbed: platen,
        ADF: adf,
        'ADF Duplex': adfDuplex.maxWidth ? adfDuplex : adf,
      },
    },
  };
}

function parseInputCapabilities(xml) {
  if (!xml) return { maxWidth: null, maxHeight: null, resolutions: [] };
  const resolutions = Array.from(xml.matchAll(
    /<(?:[A-Za-z0-9_-]+:)?XResolution\b[^>]*>([^<]+)</gi,
  ))
    .map(match => Number(match[1].trim()))
    .filter(value => Number.isSafeInteger(value) && value > 0);
  return {
    maxWidth: positiveIntegerXmlValue(xml, 'MaxWidth'),
    maxHeight: positiveIntegerXmlValue(xml, 'MaxHeight'),
    resolutions: Array.from(new Set(resolutions)),
  };
}

async function runEsclScan(device, source, options = {}) {
  const request = requestFor(options.fetchImpl);
  if (!device?.baseUrl || device.kind !== 'escl') {
    throw new Error('The selected eSCL scanner is invalid');
  }
  if (!device.sources.includes(source)) {
    throw new Error(`${source} is not supported by the selected scanner`);
  }
  const format = device.format === 'application/pdf' ? 'application/pdf' : 'image/jpeg';
  const createResponse = await request(
    `${device.baseUrl}/ScanJobs`,
    {
      method: 'POST',
      headers: {
        Accept: 'text/xml, application/xml',
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: buildScanSettings({ source, format, settings: device.scanSettings }),
    },
    CREATE_JOB_TIMEOUT_MS,
  );
  if (createResponse.status !== 201 && createResponse.status !== 202) {
    const detail = (await createResponse.text().catch(() => '')).trim().slice(0, 300);
    throw new Error(`Scanner rejected the job (HTTP ${createResponse.status})${detail ? `: ${detail}` : ''}`);
  }
  const location = createResponse.headers.get('location');
  if (!location) throw new Error('Scanner did not return a scan job location');
  const jobUrl = new URL(location, `${device.baseUrl}/`).toString().replace(/\/$/, '');
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const documentResponse = await request(
      `${jobUrl}/NextDocument`,
      { headers: { Accept: `${format}, application/pdf, image/jpeg, image/png` } },
      Math.max(1_000, deadline - Date.now()),
    );
    if (documentResponse.status === 503 || documentResponse.status === 425) {
      await delay(750);
      continue;
    }
    if (!documentResponse.ok) {
      const detail = (await documentResponse.text().catch(() => '')).trim().slice(0, 300);
      throw new Error(`Could not retrieve the scanned document (HTTP ${documentResponse.status})${detail ? `: ${detail}` : ''}`);
    }
    const buffer = Buffer.from(await documentResponse.arrayBuffer());
    if (buffer.length === 0) throw new Error('Scanner returned an empty document');
    if (buffer.length > MAX_SCAN_BYTES) throw new Error('The scan is too large to upload to PrintOps');
    const responseType = documentResponse.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    const mimeType = detectScanMimeType(buffer) || (
      responseType === 'application/pdf' || responseType === 'image/jpeg' || responseType === 'image/png'
        ? responseType
        : format
    );
    return {
      buffer,
      mimeType,
      extension: scanFileExtension(mimeType),
    };
  }
  throw new Error('The scanner did not finish within two minutes');
}

function detectScanMimeType(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  return null;
}

function scanFileExtension(mimeType) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/png') return 'png';
  return 'jpg';
}

function buildScanSettings({ source, format, settings = {} }) {
  const inputSource = source === 'Flatbed' ? 'Platen' : 'Feeder';
  const duplex = source === 'ADF Duplex';
  const sourceSettings = settings.sources?.[source] || {};
  const width = sourceSettings.maxWidth || 2550;
  const height = sourceSettings.maxHeight || (source === 'Flatbed' ? 3508 : 4500);
  const resolution = preferredResolution(sourceSettings.resolutions);
  const namespace = settings.namespace || MODERN_ESCL_NAMESPACE;
  const version = settings.version || '2.0';
  const colorMode = settings.colorMode || 'RGB24';
  const intent = settings.supportsDocumentIntent
    ? '  <scan:Intent>Document</scan:Intent>\n'
    : '';
  const extendedFormat = settings.supportsDocumentFormatExt
    ? `  <scan:DocumentFormatExt>${format}</scan:DocumentFormatExt>\n`
    : '';
  const duplexSetting = source === 'Flatbed'
    ? ''
    : `  <scan:Duplex>${duplex}</scan:Duplex>\n`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScanSettings xmlns:scan="${namespace}" xmlns:pwg="http://www.pwg.org/schemas/2010/12/sm">
  <pwg:Version>${version}</pwg:Version>
${intent}  <pwg:ScanRegions>
    <pwg:ScanRegion>
      <pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches</pwg:ContentRegionUnits>
      <pwg:XOffset>0</pwg:XOffset>
      <pwg:YOffset>0</pwg:YOffset>
      <pwg:Width>${width}</pwg:Width>
      <pwg:Height>${height}</pwg:Height>
    </pwg:ScanRegion>
  </pwg:ScanRegions>
  <pwg:InputSource>${inputSource}</pwg:InputSource>
  <scan:ColorMode>${colorMode}</scan:ColorMode>
  <pwg:DocumentFormat>${format}</pwg:DocumentFormat>
${extendedFormat}  <scan:XResolution>${resolution}</scan:XResolution>
  <scan:YResolution>${resolution}</scan:YResolution>
${duplexSetting}</scan:ScanSettings>`;
}

function preferredResolution(resolutions) {
  if (!Array.isArray(resolutions) || resolutions.length === 0) return 300;
  if (resolutions.includes(300)) return 300;
  const atMost300 = resolutions.filter(value => value <= 300).sort((a, b) => b - a);
  return atMost300[0] || Math.min(...resolutions);
}

async function fetchWithTimeout(url, init, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function requestFor(fetchImpl) {
  if (fetchImpl) {
    return (url, init, timeoutMs) => fetchWithTimeout(url, init, timeoutMs, fetchImpl);
  }
  return scannerRequest;
}

function scannerRequest(url, init = {}, timeoutMs = CAPABILITY_TIMEOUT_MS, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
      if (!['http:', 'https:'].includes(target.protocol) || !net.isIP(normalizeUrlHostname(target.hostname))) {
        throw new Error('Scanner URL must use HTTP or HTTPS with an IP address');
      }
    } catch (error) {
      reject(error);
      return;
    }

    const body = init.body === undefined ? null : Buffer.from(String(init.body));
    const headers = { ...(init.headers || {}) };
    if (body && !hasHeader(headers, 'content-length')) headers['Content-Length'] = body.length;
    const transport = target.protocol === 'https:' ? https : http;
    const request = transport.request(target, {
      method: init.method || 'GET',
      headers,
      // Office printers commonly use a self-signed device certificate. This is
      // restricted to an IP-literal scanner URL and never used for dashboard traffic.
      rejectUnauthorized: target.protocol === 'https:' ? false : undefined,
    }, response => {
      const status = Number(response.statusCode || 0);
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        response.resume();
        if (redirectCount >= 4) {
          reject(new Error('Scanner returned too many redirects'));
          return;
        }
        const redirected = new URL(location, target);
        if (normalizeUrlHostname(redirected.hostname) !== normalizeUrlHostname(target.hostname)) {
          reject(new Error('Scanner redirected the request to an unexpected host'));
          return;
        }
        // Several Canon devices use a 301 HTTP-to-HTTPS upgrade for ScanJobs.
        // Preserve the POST and XML body because changing it to GET cancels the job.
        scannerRequest(redirected.toString(), init, timeoutMs, redirectCount + 1)
          .then(resolve, reject);
        return;
      }

      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_SCAN_BYTES + 1024 * 1024) {
          request.destroy(new Error('Scanner response exceeded the maximum allowed size'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          status,
          ok: status >= 200 && status < 300,
          headers: {
            get(name) {
              const value = response.headers[String(name).toLowerCase()];
              return Array.isArray(value) ? value[0] ?? null : value ?? null;
            },
          },
          async text() { return buffer.toString('utf8'); },
          async arrayBuffer() {
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
          },
        });
      });
    });

    request.setTimeout(timeoutMs, () => request.destroy(new Error('Scanner request timed out')));
    request.on('error', error => {
      const detail = error.code || error.message || 'connection error';
      reject(new Error(`Could not connect to scanner: ${detail}`, { cause: error }));
    });
    if (body) request.write(body);
    request.end();
  });
}

function normalizeUrlHostname(hostname) {
  return String(hostname).replace(/^\[|\]$/g, '');
}

function hasHeader(headers, name) {
  return Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase());
}

function xmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<(?:[A-Za-z0-9_-]+:)?${tag}\\b[^>]*>([^<]*)<`, 'i'));
  return match ? decodeXml(match[1].trim()) : null;
}

function positiveIntegerXmlValue(xml, tag) {
  const value = Number(xmlValue(xml, tag));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function xmlBlock(xml, tag) {
  const match = xml.match(new RegExp(
    `<(?:[A-Za-z0-9_-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_-]+:)?${tag}>`,
    'i',
  ));
  return match ? match[1] : '';
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

module.exports = {
  buildScanSettings,
  detectScanMimeType,
  discoverEsclDevices,
  parseScannerCapabilities,
  scannerRequest,
  runEsclScan,
};
