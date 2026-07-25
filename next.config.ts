import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { screenRewrites } from "./campaign-screen-rewrites.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const isProductionBuild = process.env.NODE_ENV === "production";
// Amplify Hosting Compute (WEB_COMPUTE) expects a normal Next.js `.next` build
// with required-server-files.json. Static `output: "export"` only for non-Amplify
// production builds (e.g. Hostinger). Amplify sets AWS_APP_ID during CI.
const isAmplifyBuild = Boolean(process.env.AWS_APP_ID);
const useStaticExport = isProductionBuild && !isAmplifyBuild;

const nextConfig: NextConfig = {
  ...(useStaticExport ? { output: "export" as const } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
  // Standalone Forkup-Web repo (Amplify). Use app root — not parent (that was for local monorepo layout).
  outputFileTracingRoot: __dirname,
  devIndicators: false,
  experimental: {
    // Avoid lucide barrel import issues in dev (missing icon modules).
    optimizePackageImports: [],
  },
  async rewrites() {
    // Static export ignores rewrites; Amplify SSR and local `next dev` can use them.
    if (useStaticExport) return [];

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
