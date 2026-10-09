import { daysBetween } from "./memberships";

// Personal training: a client's package and how much of it is left.

export type PtSubscriptionLike = {
  status: string;
  starts_on: string;
  ends_on: string;
  sessions_total: number | null;
};

export type PtState =
  | { kind: "active"; used: number; left: number | null; daysLeft: number }
  | { kind: "upcoming"; used: number; left: number | null }
  | { kind: "used_up"; used: number }
  | { kind: "expired"; used: number; left: number | null }
  | { kind: "cancelled"; used: number };

export function ptState(sub: PtSubscriptionLike, used: number, today: string): PtState {
  const left = sub.sessions_total === null ? null : Math.max(0, sub.sessions_total - used);
  if (sub.status === "cancelled") return { kind: "cancelled", used };
  if (left === 0) return { kind: "used_up", used };
  if (sub.ends_on < today) return { kind: "expired", used, left };
  if (sub.starts_on > today) return { kind: "upcoming", used, left };
  return { kind: "active", used, left, daysLeft: daysBetween(today, sub.ends_on) + 1 };
}

// Running low: few sessions left, or within a week of the end date.
export function ptRunningLow(state: PtState, warnSessions: number) {
  return state.kind === "active" && ((state.left !== null && state.left <= warnSessions) || state.daysLeft <= 7);
}

// "8 of 12 left" / "Unlimited · 5 done"
export function formatSessionsLeft(sub: Pick<PtSubscriptionLike, "sessions_total">, used: number) {
  if (sub.sessions_total === null) return `Unlimited · ${used} done`;
  const left = Math.max(0, sub.sessions_total - used);
  return `${left} of ${sub.sessions_total} left`;
}

// "12 sessions" / "Unlimited sessions"
export function formatSessions(sessions: number | null) {
  return sessions === null ? "Unlimited sessions" : `${sessions} ${sessions === 1 ? "session" : "sessions"}`;
}
