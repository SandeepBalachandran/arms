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
