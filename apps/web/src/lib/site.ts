// Public site and mobile app settings.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Android application id of the Flutter app (mobile/android/app/build.gradle).
export const ANDROID_PACKAGE = process.env.NEXT_PUBLIC_ANDROID_PACKAGE ?? "com.gymos.app";

// Play Store listing. The referrer survives install, so the app can join the
// gym on first launch (read with the Play Install Referrer API).
export function playStoreUrl(gymSlug?: string) {
  const url = new URL("https://play.google.com/store/apps/details");
  url.searchParams.set("id", ANDROID_PACKAGE);
  if (gymSlug) url.searchParams.set("referrer", `gym=${gymSlug}`);
  return url.toString();
}

// The link gym owners share. With App Links verified it opens the app directly;
// otherwise it lands on /join/[slug], which offers the install.
export function joinUrl(gymSlug: string) {
  return `${SITE_URL}/join/${gymSlug}`;
}
