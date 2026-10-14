import type { ConfigContext, ExpoConfig } from "expo/config";

// Static settings live in app.json. This adds the deep-link setup, which
// depends on the domain the web app is deployed to.
const linkHost = process.env.EXPO_PUBLIC_APP_LINK_HOST ?? "gymos.app";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  // The web build is served by the admin site under /app (one origin, one PWA).
  // Set only when exporting for that (scripts/build-site.mjs); the dev server stays at the root.
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_PUBLIC_WEB_BASE ? { baseUrl: process.env.EXPO_PUBLIC_WEB_BASE } : {}),
  },
  android: {
    ...config.android,
    // https://<host>/join/<slug> opens the app (verified via
    // apps/web /.well-known/assetlinks.json).
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: linkHost, pathPrefix: "/join" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  ios: {
    ...config.ios,
    associatedDomains: [`applinks:${linkHost}`],
  },
});
