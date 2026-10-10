import { z } from "zod";
import { openingHoursSchema } from "./hours";
import { MANUAL_PAYMENT_METHODS } from "./memberships";

// Per-gym settings (columns on public.gyms) and the helpers that use them.

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "QAR", "SGD", "AUD", "CAD", "LKR", "NPR", "BDT"] as const;

export const RENEWAL_MESSAGE_PLACEHOLDERS = ["{name}", "{gym}", "{date}", "{plan}"] as const;

// "Hi {name}, …" → "Hi Asha, …". Unknown placeholders are left as typed.
export function renderTemplate(template: string, values: { name?: string; gym?: string; date?: string; plan?: string }) {
  return template.replace(/\{(name|gym|date|plan)\}/g, (match, key: keyof typeof values) => values[key] ?? match);
}

// wa.me wants digits with the country code. Numbers that already look
// international (11+ digits, or starting with +) are kept; shorter local
// numbers get the gym's country code.
export function whatsappNumber(phone: string | null | undefined, countryCode: string) {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < 6) return null;
  if (trimmed.startsWith("+") || digits.length >= 11) return digits;
  return `${countryCode}${digits}`;
}

export function formatReceipt(prefix: string, receiptNo: number | null) {
  return receiptNo === null ? "—" : `${prefix || "#"}${receiptNo}`;
}

// Any IANA zone the runtime can format, including aliases such as
// Asia/Kolkata that Intl.supportedValuesOf may list under an older name.
export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Options for a timezone picker: the runtime's list plus the current value and
// the default, so a saved zone is never missing from the dropdown.
export function timezoneOptions(current: string) {
  return [...new Set([...Intl.supportedValuesOf("timeZone"), current, "Asia/Kolkata"])].sort();
}

// Validation for the settings forms (also mirrors the DB check constraints).
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const bool = z.enum(["true", "false"]).transform((v) => v === "true");

export const generalSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).transform((v) => v || null),
  phone: z.string().trim().max(20).transform((v) => v || null),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  currency: z.enum(CURRENCIES),
  phone_country_code: z.string().trim().regex(/^[0-9]{1,4}$/, "Country code is 1–4 digits, e.g. 91"),
});

export const membershipSettingsSchema = z.object({
  expiry_warning_days: int(1, 60),
  renewal_message: z.string().trim().min(10, "Message is too short").max(500),
  receipt_prefix: z.string().trim().regex(/^[A-Za-z0-9/-]{0,10}$/, "Up to 10 letters, digits, / or -"),
  manual_payment_methods: z.array(z.enum(MANUAL_PAYMENT_METHODS)).min(1, "Allow at least one payment method"),
  join_requires_approval: bool,
});

export const checkinSettingsSchema = z.object({
  checkin_enabled: bool,
  checkin_self_allowed: bool,
  checkin_dedupe_hours: int(0, 24),
});

const coordinate = (limit: number) =>
  z.union([z.literal(""), z.coerce.number().min(-limit).max(limit)]).transform((v) => (v === "" ? null : v));

// QR poster check-in (members scan the gym's poster) and its optional location check.
export const posterCheckinSettingsSchema = z
  .object({
    checkin_poster_enabled: bool,
    checkin_location_required: bool,
    checkin_radius_m: int(50, 2000),
    latitude: coordinate(90),
    longitude: coordinate(180),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), "Enter both latitude and longitude, or neither")
  .refine((v) => !v.checkin_location_required || v.latitude !== null, "Set the gym's location to use the location check");

export const classSettingsSchema = z.object({
  classes_enabled: bool,
  classes_booking_window_days: int(1, 60),
  classes_cancel_cutoff_hours: int(0, 72),
  classes_require_membership: bool,
});

export const workoutSettingsSchema = z.object({
  workouts_enabled: bool,
});

export const ptSettingsSchema = z.object({
  pt_enabled: bool,
  pt_show_in_app: bool,
  pt_expiry_warning_sessions: int(0, 50),
});

export const nutritionSettingsSchema = z.object({
  nutrition_enabled: bool,
  nutrition_all_members: bool,
});

// The hours editor posts the whole week as JSON.
export const hoursSettingsSchema = z.object({
  opening_hours: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid opening hours" });
        return z.NEVER;
      }
    })
    .pipe(openingHoursSchema),
  opening_hours_note: z.string().trim().max(200).transform((v) => v || null),
});

// Defaults for a new gym (mirror the column defaults in
// supabase/migrations/*_gym_settings.sql). Shown as hints in Settings.
export const GYM_DEFAULTS = {
  timezone: "Asia/Kolkata",
  currency: "INR",
  phone_country_code: "91",
  expiry_warning_days: 7,
  renewal_message:
    "Hi {name}, your {gym} membership ends on {date}. Renew at the front desk or in the GOS app.",
  receipt_prefix: "",
  checkin_dedupe_hours: 3,
  checkin_radius_m: 200,
  classes_booking_window_days: 7,
  classes_cancel_cutoff_hours: 0,
  pt_expiry_warning_sessions: 2,
} as const;

// Phone in international digits without "+" (how Supabase Auth stores it),
// using the gym's country code for local numbers. Null if it isn't a number.
export function internationalPhone(phone: string, countryCode: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return trimmed.startsWith("+") || digits.length >= 11 ? digits : `${countryCode}${digits}`;
}
