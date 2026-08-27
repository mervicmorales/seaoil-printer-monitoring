export const BLOB_SKINS = [
  { id: "violet", label: "Violet", swatch: "#c57af3" },
  { id: "blue", label: "Ocean blue", swatch: "#55a9ef" },
  { id: "teal", label: "Teal", swatch: "#42c7b5" },
  { id: "green", label: "Leaf green", swatch: "#72c96a" },
  { id: "orange", label: "Sunset orange", swatch: "#f49a55" },
  { id: "pink", label: "Rose pink", swatch: "#ed79b4" },
] as const;

export type BlobSkin = (typeof BLOB_SKINS)[number]["id"];

export function isBlobSkin(value: string | undefined): value is BlobSkin {
  return BLOB_SKINS.some((skin) => skin.id === value);
}

export function getBlobSkinCookieName(accountId: string) {
  return `seaoil-blob-skin-${accountId}`;
}
