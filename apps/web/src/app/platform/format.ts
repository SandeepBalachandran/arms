// Small display helpers for the platform pages.
const DAY = 24 * 60 * 60 * 1000;

export function ago(iso: string | null) {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

// No check-ins, payments or team actions for two weeks.
export const quiet = (iso: string | null) => !iso || Date.now() - new Date(iso).getTime() > 14 * DAY;

export const date = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
