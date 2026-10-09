import type { Database } from "./database.types";

export type ScheduledClass = Database["public"]["Functions"]["class_schedule"]["Returns"][number];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Local "YYYY-MM-DD" day of an instant in the gym's timezone.
export function dayKey(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

export function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

// "Mon, 13 Oct" for a YYYY-MM-DD day.
export function formatDay(ymd: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${ymd}T00:00:00Z`),
  );
}

export function spotsLeft(c: Pick<ScheduledClass, "capacity" | "booked_count">) {
  return Math.max(0, c.capacity - c.booked_count);
}

export function hasStarted(startsAt: string, now = Date.now()) {
  return new Date(startsAt).getTime() <= now;
}

// Members may cancel a booked spot until `cutoffHours` before the class
// (0 = any time); leaving a waitlist is always allowed. Mirrors cancel_booking().
export function canMemberCancel(
  c: Pick<ScheduledClass, "starts_at" | "my_status">,
  cutoffHours: number,
  now = Date.now(),
) {
  if (c.my_status === "waitlisted") return true;
  return cutoffHours === 0 || new Date(c.starts_at).getTime() - now >= cutoffHours * 3_600_000;
}
