import type { MetadataRoute } from "next";
import { BRAND } from "@gymos/shared";

// The installable web app (one app for members and gym staff), served at
// /manifest.webmanifest. Its name comes from packages/shared/src/brand.ts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.tagline}`,
    short_name: BRAND.name,
    description: "Memberships, check-ins, classes and workouts. Members and gym staff sign in here.",
    id: "/",
    start_url: "/go",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1f2a10",
    theme_color: "#1f2a10",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
