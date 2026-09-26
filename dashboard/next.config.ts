import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  assetPrefix: process.env.NEXT_ASSET_PREFIX || undefined,
  compress: true,
  async headers() {
    return [{
      source: "/branding/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
    }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
