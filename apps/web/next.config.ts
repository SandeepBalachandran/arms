import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents stays off: nearly every page is per-user and per-gym, so
  // there is no static shell worth prerendering.
  reactCompiler: true,
  // The dev badge sits over the admin's bottom tab bar on phones.
  devIndicators: false,
  // Workspace package shipped as TypeScript source.
  transpilePackages: ["@gymos/shared"],
  // The member app (Expo web build in public/app) is one page: any /app/... path that is not a file opens it.
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/app/:path*", destination: "/app/index.html" }] };
  },
  // Gym logo uploads go through a server action (2 MB max; the default is 1 MB).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
