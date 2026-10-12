import { formatTime } from "./classes";
import { addDays, formatDate, formatMoney, todayIn } from "./memberships";

// Member notifications: stored ones (written by database triggers, see the
// notifications migration) and reminders worked out from the date. Both are
// shown in the app's Notifications screen through describeNotification().

export type NotificationKind =
  | "payment_paid"
  | "payment_rejected"
  | "class_cancelled"
  | "trainer_comment"
  | "plan_assigned"
  | "pt_session";

// Where tapping a notification goes in the member app.
export type NotificationLink = `/receipt/${string}` | "/membership" | "/classes" | "/food" | "/workouts";

export type NotificationView = {
  title: string;
  body: string | null;
  link: NotificationLink | null;
  // Picks the icon and colour.
  tone: "good" | "bad" | "info";
};

type Data = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);

// "Today", "Yesterday", "Tomorrow" or "14 Oct 2026".
export function relativeDay(ymd: string, today: string) {
  if (ymd === today) return "Today";
  if (ymd === addDays(today, -1)) return "Yesterday";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  return formatDate(ymd);
}

// "Just now", "5m", "3h", "2d", then the date.
export function timeAgo(iso: string, now = new Date()) {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))}d`;
  return formatDate(new Date(iso).toISOString().slice(0, 10));
}

export function describeNotification(
  kind: string,
  data: Data,
  gym: { timezone: string; currency: string },
  now = new Date(),
): NotificationView {
  const today = todayIn(gym.timezone, now);
  const amount = num(data.amount_paise) === null ? null : formatMoney(num(data.amount_paise)!, gym.currency);

  switch (kind as NotificationKind) {
    case "payment_paid":
      return {
        title: amount ? `Payment received: ${amount}` : "Payment received",
        body: [str(data.what), str(data.receipt) && `Receipt ${data.receipt}`].filter(Boolean).join(" · ") || null,
        link: str(data.payment_id) ? `/receipt/${data.payment_id}` : null,
        tone: "good",
      };
    case "payment_rejected":
      return {
        title: amount ? `UPI payment of ${amount} not confirmed` : "UPI payment not confirmed",
        body: str(data.reason) ?? "The gym couldn't find this payment. Check with the front desk.",
        link: "/membership",
        tone: "bad",
      };
    case "class_cancelled": {
      const startsAt = str(data.starts_at);
      const when = startsAt ? `${relativeDay(todayIn(gym.timezone, new Date(startsAt)), today)}, ${formatTime(startsAt, gym.timezone)}` : null;
      return {
        title: `${str(data.class_name) ?? "Class"} cancelled`,
        body: [when, str(data.reason)].filter(Boolean).join(" · ") || null,
        link: "/classes",
        tone: "bad",
      };
    }
    case "trainer_comment":
      return {
        title: `${str(data.author) ?? "Your trainer"} commented on your food log`,
        body: str(data.body),
        link: "/food",
        tone: "info",
      };
    case "plan_assigned":
      return {
        title: `New workout plan: ${str(data.plan_name) ?? "from your trainer"}`,
        body: str(data.author) ? `From ${data.author}` : null,
        link: "/workouts",
        tone: "info",
      };
    case "pt_session": {
      const left = num(data.sessions_left);
      const day = str(data.session_on);
      return {
        title: "PT session logged",
        body:
          [day && relativeDay(day, today), left === null ? null : `${left} ${left === 1 ? "session" : "sessions"} left`, str(data.notes)]
            .filter(Boolean)
            .join(" · ") || null,
        link: "/membership",
        tone: "info",
      };
    }
    default:
      return { title: "Update from your gym", body: null, link: null, tone: "info" };
  }
}
