import { z } from "zod";
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

// Validation for the settings forms (also mirrors the DB check constraints).
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const bool = z.enum(["true", "false"]).transform((v) => v === "true");

export const generalSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).transform((v) => v || null),
  phone: z.string().trim().max(20).transform((v) => v || null),
  timezone: z.string().refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz), "Unknown timezone"),
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

export const classSettingsSchema = z.object({
  classes_enabled: bool,
  classes_booking_window_days: int(1, 60),
  classes_cancel_cutoff_hours: int(0, 72),
  classes_require_membership: bool,
});

export const workoutSettingsSchema = z.object({
  workouts_enabled: bool,
});

// Defaults for a new gym (mirror the column defaults in
// supabase/migrations/*_gym_settings.sql). Shown as hints in Settings.
export const GYM_DEFAULTS = {
  timezone: "Asia/Kolkata",
  currency: "INR",
  phone_country_code: "91",
  expiry_warning_days: 7,
  renewal_message:
    "Hi {name}, your {gym} membership ends on {date}. Renew at the front desk or in the GymOS app.",
  receipt_prefix: "",
  checkin_dedupe_hours: 3,
  classes_booking_window_days: 7,
  classes_cancel_cutoff_hours: 0,
} as const;
