export type ScanFileType = {
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  extension: "pdf" | "jpg" | "png";
};

export function detectScanFileType(data: Uint8Array): ScanFileType | null {
  if (startsWith(data, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mimeType: "application/pdf", extension: "pdf" };
  }
  if (startsWith(data, [0xff, 0xd8, 0xff])) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png", extension: "png" };
  }
  return null;
}

export function replaceScanFileExtension(name: string, extension: string) {
  const baseName = name.replace(/\.[^./\\]+$/, "");
  return `${baseName}.${extension}`;
}

function startsWith(data: Uint8Array, signature: readonly number[]) {
  return data.length >= signature.length && signature.every((byte, index) => data[index] === byte);
}
