const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_MAX_SCAN_BYTES = 24 * 1024 * 1024;

function detectScanFormat(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 16 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    const trailer = buffer.subarray(Math.max(0, buffer.length - 2048)).toString('latin1');
    if (/%%EOF(?:\s|$)/.test(trailer)) return { extension: '.pdf', mimeType: 'application/pdf' };
    return null;
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: '.jpg', mimeType: 'image/jpeg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: '.png', mimeType: 'image/png' };
  }
  return null;
}

function validateScanBuffer(buffer, options = {}) {
  const maxBytes = options.maxBytes || DEFAULT_MAX_SCAN_BYTES;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('Scanner produced an empty output file.');
  if (buffer.length > maxBytes) throw new Error(`Scanner output exceeds the ${maxBytes}-byte safety limit.`);
  const format = detectScanFormat(buffer);
  if (!format) throw new Error('Scanner output is incomplete or has an unsupported file signature.');
  return { ...format, size: buffer.length };
}

function resolveContainedPath(rootDirectory, candidatePath) {
  const root = path.resolve(rootDirectory);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('Scanner output path must be a file inside the configured scan directory.');
  }
  return candidate;
}

function generatedScanPath(rootDirectory, extension = '.pdf') {
  const safeExtension = /^\.[a-z0-9]{1,8}$/i.test(extension) ? extension.toLowerCase() : '.pdf';
  return resolveContainedPath(rootDirectory, path.join(rootDirectory, `scan-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExtension}`));
}

async function validateScanFile(filePath, rootDirectory, options = {}) {
  const fileSystem = options.fs || fs.promises;
  const containedPath = resolveContainedPath(rootDirectory, filePath);
  try {
    const buffer = await fileSystem.readFile(containedPath);
    const metadata = validateScanBuffer(buffer, options);
    const expectedPath = containedPath.slice(0, containedPath.length - path.extname(containedPath).length) + metadata.extension;
    const finalPath = resolveContainedPath(rootDirectory, expectedPath);
    if (finalPath !== containedPath) await fileSystem.rename(containedPath, finalPath);
    return { ...metadata, filePath: finalPath, buffer };
  } catch (error) {
    try { await fileSystem.unlink(containedPath); } catch {}
    throw error;
  }
}

module.exports = {
  DEFAULT_MAX_SCAN_BYTES,
  detectScanFormat,
  generatedScanPath,
  resolveContainedPath,
  validateScanBuffer,
  validateScanFile,
};
