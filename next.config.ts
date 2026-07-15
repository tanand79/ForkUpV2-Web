import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { screenRewrites } from "./campaign-screen-rewrites.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Static export only for `next build` — not during `next dev` (avoids webpack/rewrite conflicts).
  ...(isProductionBuild ? { output: "export" as const } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(__dirname, ".."),
  devIndicators: false,
  experimental: {
    // Avoid lucide barrel import issues in dev (missing icon modules).
    optimizePackageImports: [],
  },
  async rewrites() {
    const isDev = process.env.NODE_ENV !== "production";
    // In dev, always proxy /api to the local Nest/Express API (port 3001).
    const proxyApi = isDev || !process.env.NEXT_PUBLIC_API_URL;
    const apiRewrites = proxyApi
      ? [
          { source: "/api/improve-story", destination: "/api/improve-story" },
          { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
          { source: "/uploads/:path*", destination: `${apiUrl}/uploads/:path*` },
        ]
      : [];
    return [...screenRewrites, ...apiRewrites];
  },
};

export default nextConfig;
