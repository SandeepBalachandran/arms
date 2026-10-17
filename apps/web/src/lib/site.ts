// Public site and mobile app settings.

// The site's own address, for links people open elsewhere (join links, QR
// posters, sign-in emails). NEXT_PUBLIC_SITE_URL once there's a custom domain;
// until then Vercel's production address (set by Vercel on every deploy), so a
// missing setting never sends people to localhost.
const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000")
).replace(/[/]$/, "");

// Android application id of the app (apps/mobile/app.json), for App Links.
export const ANDROID_PACKAGE = process.env.NEXT_PUBLIC_ANDROID_PACKAGE ?? "com.gymos.app";

// Where Android users download the app: an APK link now, the Play Store
// listing once it's published. Unset means there's nowhere to send them, so
// the "Get the Android app" buttons stay hidden (the web app works anyway).
const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || undefined;

export function androidAppUrl(gymSlug?: string) {
  if (!ANDROID_APP_URL) return null;
  const url = new URL(ANDROID_APP_URL);
  // On the Play Store the referrer survives install, so the app can join the
  // gym on first launch (read with the Play Install Referrer API).
  if (gymSlug && url.hostname === "play.google.com") url.searchParams.set("referrer", `gym=${gymSlug}`);
  return url.toString();
}

// The link gym owners share. With App Links verified it opens the app directly;
// otherwise it lands on /join/[slug], which offers the install.
export function joinUrl(gymSlug: string) {
  return `${SITE_URL}/join/${gymSlug}`;
}

// Where the member app's web build is hosted: this same site, under /app (see
// scripts/build-site.mjs). Set NEXT_PUBLIC_MEMBER_WEB_APP_URL to host it elsewhere.
export const MEMBER_WEB_APP_URL = (
  process.env.NEXT_PUBLIC_MEMBER_WEB_APP_URL ?? (process.env.NODE_ENV === "production" ? `${SITE_URL}/app` : undefined)
)?.replace(/[/]$/, "");

export function memberWebJoinUrl(gymSlug: string) {
  return MEMBER_WEB_APP_URL ? `${MEMBER_WEB_APP_URL}/join/${gymSlug}` : null;
}
