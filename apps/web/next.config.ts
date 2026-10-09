import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents stays off: nearly every page is per-user and per-gym, so
  // there is no static shell worth prerendering.
  reactCompiler: true,
  // Workspace package shipped as TypeScript source.
  transpilePackages: ["@gymos/shared"],
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
