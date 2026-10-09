import { z } from "zod";

// Gym opening hours: a morning and an evening session per weekday, either of
// which may be closed. Stored in gyms.opening_hours (see *_hours_and_pt.sql).

export const HOURS_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type HoursDay = (typeof HOURS_DAYS)[number];
export const HOURS_DAY_LABELS: Record<HoursDay, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

export const SESSIONS = ["morning", "evening"] as const;
export type SessionName = (typeof SESSIONS)[number];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM times");
const range = z
  .tuple([time, time])
  .refine(([open, close]) => open < close, "Closing time must be after opening time");
const day = z.object({ morning: range.nullish(), evening: range.nullish() }).refine(
  (d) => !d.morning || !d.evening || d.morning[1] <= d.evening[0],
  "Evening must start after the morning session ends",
);

export const openingHoursSchema = z.object(
  Object.fromEntries(HOURS_DAYS.map((d) => [d, day.default({})])) as Record<HoursDay, z.ZodDefault<typeof day>>,
);
export type OpeningHours = z.infer<typeof openingHoursSchema>;
export type DayHours = OpeningHours[HoursDay];

// Read whatever is stored, falling back to "closed" for anything malformed.
export function parseOpeningHours(value: unknown): OpeningHours {
  const parsed = openingHoursSchema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  return Object.fromEntries(HOURS_DAYS.map((d) => [d, {}])) as OpeningHours;
}

// "05:00" → "5:00 am", "16:30" → "4:30 pm"
export function formatClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export function formatRange(range: readonly [string, string] | null | undefined) {
  return range ? `${formatClock(range[0])} – ${formatClock(range[1])}` : "Closed";
}

// Weekday key and "HH:MM" of an instant in the gym's timezone.
function localNow(timezone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: get("weekday").toLowerCase().slice(0, 3) as HoursDay, time: `${get("hour")}:${get("minute")}` };
}

function ranges(d: DayHours) {
  return SESSIONS.map((s) => d[s]).filter((r): r is [string, string] => !!r);
}

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string; when: "today" | "tomorrow" | HoursDay }
  | { open: false; opensAt: null };

// Is the gym open right now, and until when / from when?
export function openStatus(hours: OpeningHours, timezone: string, now = new Date()): OpenStatus {
  const { day, time: t } = localNow(timezone, now);
  const start = HOURS_DAYS.indexOf(day);
  const today = ranges(hours[day]);
  const current = today.find(([open, close]) => open <= t && t < close);
  if (current) return { open: true, closesAt: current[1] };
  const later = today.find(([open]) => open > t);
  if (later) return { open: false, opensAt: later[0], when: "today" };
  for (let i = 1; i <= 7; i++) {
    const next = HOURS_DAYS[(start + i) % 7];
    const first = ranges(hours[next])[0];
    if (first) return { open: false, opensAt: first[0], when: i === 1 ? "tomorrow" : next };
  }
  return { open: false, opensAt: null };
}

// "Open now · until 10:00 am" / "Closed · opens 4:00 pm" / "Closed · opens Mon 5:00 am"
export function describeOpenStatus(status: OpenStatus) {
  if (status.open) return `Open now · until ${formatClock(status.closesAt)}`;
  if (!status.opensAt) return "Closed";
  const when = status.when === "today" ? "" : status.when === "tomorrow" ? "tomorrow " : `${HOURS_DAY_LABELS[status.when].slice(0, 3)} `;
  return `Closed · opens ${when}${formatClock(status.opensAt)}`;
}

// Today's weekday key in the gym's timezone (to highlight it in a week table).
export function todayHoursDay(timezone: string, now = new Date()) {
  return localNow(timezone, now).day;
}
