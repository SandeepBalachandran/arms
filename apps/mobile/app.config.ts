import type { ConfigContext, ExpoConfig } from "expo/config";

// eslint-disable-next-line import/no-relative-packages -- read by the Expo CLI, outside Metro
const BRAND = require("../../packages/shared/src/brand.json") as { name: string };

// Static settings live in app.json. This adds the deep-link setup, which
// depends on the domain the web app is deployed to.
const linkHost = process.env.EXPO_PUBLIC_APP_LINK_HOST ?? "gymos.app";

// app.json writes the product's name as {app}: the name on the phone and in the
// permission prompts come from packages/shared/src/brand.ts.
const withName = <T,>(value: T): T => JSON.parse(JSON.stringify(value).replaceAll("{app}", BRAND.name));

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...withName(config as ExpoConfig),
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
