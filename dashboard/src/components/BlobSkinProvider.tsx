"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getBlobSkinCookieName, type BlobSkin } from "@/lib/blob-skins";

type BlobSkinContextValue = {
  blobSkin: BlobSkin;
  setBlobSkin: (skin: BlobSkin) => void;
};

const BlobSkinContext = createContext<BlobSkinContextValue | null>(null);

export function BlobSkinProvider({
  accountId,
  initialSkin,
  children,
}: {
  accountId: string;
  initialSkin: BlobSkin;
  children: ReactNode;
}) {
  const [blobSkin, setBlobSkin] = useState<BlobSkin>(initialSkin);

  useEffect(() => {
    document.cookie = `${getBlobSkinCookieName(accountId)}=${blobSkin}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [accountId, blobSkin]);

  return (
    <BlobSkinContext value={{ blobSkin, setBlobSkin }}>
      {children}
    </BlobSkinContext>
  );
}

export function useBlobSkin() {
  const context = useContext(BlobSkinContext);
  if (!context) {
    throw new Error("useBlobSkin must be used inside BlobSkinProvider");
  }
  return context;
}
