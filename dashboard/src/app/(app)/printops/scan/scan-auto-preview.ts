export const SCAN_AUTO_PREVIEW_STORAGE_KEY = "seaoil-scan-auto-preview-v1";

export function shouldAutoPreviewScan(
  scanId: number,
  lastAutoPreviewedScanId: string | null,
) {
  return lastAutoPreviewedScanId !== String(scanId);
}
