import type { Json } from "./database.types";

// What the check-in RPCs return (self_check_in, check_in_by_token, staff_check_in).
export type CheckinResult = {
  checkin_id: string;
  checked_in_at: string;
  // True when the member had already checked in within the last 3 hours.
  duplicate: boolean;
  member_id: string;
  full_name: string;
  // False when there is no subscription covering today. Informational only.
  membership_ok: boolean;
  ends_on: string | null;
};

export function asCheckinResult(data: Json): CheckinResult {
  return data as unknown as CheckinResult;
}

export const CHECKIN_TOKEN_REFRESH_MS = 50_000;

export function isCheckinToken(text: string) {
  return text.startsWith("gymos-ci:");
}

// The gym's QR poster encodes a link, so a phone camera that isn't the GOS app
// still lands on a page that explains what to do:
//   https://<site>/checkin/<gym code>?k=<version>.<signature>
export function posterCheckinUrl(siteUrl: string, slug: string, key: string) {
  return `${siteUrl.replace(/\/$/, "")}/checkin/${slug}?k=${key}`;
}

export function parsePosterCode(text: string): { slug: string; key: string } | null {
  const match = text.match(/\/checkin\/([a-z0-9-]{3,40})\?k=(\d+\.[0-9a-f]+)/);
  return match ? { slug: match[1], key: match[2] } : null;
}
