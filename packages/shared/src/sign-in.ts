// Signing in with phone number + PIN, for members without an email (often
// added by the front desk). Supabase signs people in by email + password, so
// such a member gets a placeholder address that never receives mail, and the
// PIN is their password. The web app's /api/auth/pin finds the account by
// phone and signs in with it. The placeholder is never shown to anyone.

export const PIN_LENGTH = 6;
const PLACEHOLDER_DOMAIN = "phone.squatpress.invalid";

/** "919847012345" → "919847012345@phone.squatpress.invalid" */
export const placeholderEmail = (intlPhone: string) => `${intlPhone}@${PLACEHOLDER_DOMAIN}`;

export const isPlaceholderEmail = (email: string | null | undefined) => !!email && email.endsWith(`@${PLACEHOLDER_DOMAIN}`);

/** The email to show: null for a placeholder. */
export const shownEmail = (email: string | null | undefined) => (email && !isPlaceholderEmail(email) ? email : null);

export const isPin = (pin: string) => pin.length === PIN_LENGTH && /^\d+$/.test(pin);
