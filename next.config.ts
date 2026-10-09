import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Off: nearly every page is per-user and per-gym, so there is no static
  // shell worth prerendering.
  reactCompiler: true,
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
