import { ANDROID_PACKAGE } from "@/lib/site";

// Digital Asset Links: lets Android verify that https://<site>/join/* links
// should open the GymOS app. Fingerprints are the SHA-256 of the app signing
// certificates (debug + Play App Signing), comma-separated.
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
