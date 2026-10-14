import { BRAND } from "./brand";
import { formatMoney, PAYMENT_METHOD_LABELS } from "./memberships";
import { PERMISSIONS, ROLE_TITLES } from "./permissions";
import type { GymRole } from "./gyms";
import type { Permission } from "./permissions";

// The activity log (public.audit_log, written by database triggers), as plain
// sentences for the owner's Activity page and the platform view.

export type AuditEntry = {
  action: string;
  actor_name: string;
  actor_platform: boolean;
  details: unknown;
  created_at: string;
};

export type AuditGroup = "money" | "people" | "settings" | "support";

export const AUDIT_GROUP_LABELS: Record<AuditGroup, string> = {
  money: "Money",
  people: "People & roles",
  settings: "Gym & plans",
  support: "Support",
};

export function auditGroup(action: string): AuditGroup {
  if (action.startsWith("payment.") || action.startsWith("membership.")) return "money";
  if (action.startsWith("member.") || action.startsWith("permissions.")) return "people";
  if (action.startsWith("platform.")) return "support";
  return "settings";
}

// Who did it. Owners see platform admins as "<name> support".
export function auditActor(entry: Pick<AuditEntry, "actor_name" | "actor_platform">, forOwner: boolean) {
  if (entry.actor_platform) return forOwner ? `${BRAND.name} support` : `${entry.actor_name} (support)`;
  return entry.actor_name;
}

type D = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const roles = (v: unknown) =>
  Array.isArray(v) && v.length ? v.map((r) => ROLE_TITLES[r as GymRole] ?? str(r)).join(" + ") : "no role";
const permissionLabel = (key: unknown) => PERMISSIONS.find((p) => p.key === (key as Permission))?.label ?? str(key);
const method = (v: unknown) => PAYMENT_METHOD_LABELS[v as keyof typeof PAYMENT_METHOD_LABELS] ?? str(v);
const field = (f: string) => f.replace(/_/g, " ");

export function describeAudit(entry: Pick<AuditEntry, "action" | "details">, currency = "INR"): string {
  const d = (entry.details && typeof entry.details === "object" ? entry.details : {}) as D;
  const member = str(d.member) || "a member";
  const money = (key = "amount_paise") => formatMoney(num(d[key]), currency);

  switch (entry.action) {
    case "payment.recorded":
      return `Recorded ${money()} (${method(d.method)}) from ${member}`;
    case "payment.upi_claimed":
      return `${member} says they paid ${money()} by UPI`;
    case "payment.upi_confirmed":
      return `Confirmed ${member}'s UPI payment of ${money()}`;
    case "payment.upi_rejected":
      return `Rejected ${member}'s UPI payment of ${money()}`;
    case "payment.refunded":
      return `Marked ${member}'s payment of ${money()} as refunded`;
    case "payment.amount_changed":
      return `Changed ${member}'s payment from ${money("from_paise")} to ${money()}`;
    case "payment.status_changed":
      return `Changed ${member}'s payment of ${money()} from ${str(d.from)} to ${str(d.to)}`;
    case "payment.deleted":
      return `Deleted ${member}'s payment of ${money()}`;
    case "membership.cancelled":
      return `Cancelled ${member}'s ${str(d.plan)} membership`;
    case "membership.deleted":
      return `Deleted ${member}'s ${str(d.plan)} membership`;
    case "member.joined":
      if (d.status === "pending") return `${member} asked to join`;
      return d.role && d.role !== "member" ? `${member} joined as ${roles([d.role])}` : `${member} joined`;
    case "member.roles_changed":
      return `Changed ${member}'s role from ${roles(d.from)} to ${roles(d.to)}`;
    case "member.status_changed":
      if (d.from === "pending" && d.to === "active") return `Approved ${member}`;
      if (d.to === "inactive") return `Deactivated ${member}`;
      if (d.to === "active") return `Reactivated ${member}`;
      return `Changed ${member}'s status from ${str(d.from)} to ${str(d.to)}`;
    case "member.removed":
      return `Removed ${member}`;
    case "permissions.changed": {
      const who = roles([d.role]);
      const what = permissionLabel(d.permission);
      if (d.default) return `Reset "${what}" for ${who} to the default (${d.allowed ? "allowed" : "not allowed"})`;
      return `${d.allowed ? "Allowed" : "Stopped"} ${who}: ${what}`;
    }
    case "plan.created":
      return `Created the ${str(d.plan)} plan at ${money("price_paise")}`;
    case "plan.updated": {
      const changes: string[] = [];
      if (d.from_name && d.from_name !== d.plan) changes.push(`renamed from ${str(d.from_name)}`);
      if (num(d.from_price_paise) !== num(d.price_paise)) changes.push(`price ${money("from_price_paise")} → ${money("price_paise")}`);
      if (d.active === false) changes.push("hidden from members");
      return `Changed the ${str(d.plan)} plan${changes.length ? `: ${changes.join(", ")}` : ""}`;
    }
    case "plan.deleted":
      return `Deleted the ${str(d.plan)} plan`;
    case "gym.registered":
      return `Registered ${str(d.gym)} (code ${str(d.slug)})`;
    case "gym.deleted":
      return "Deleted the gym";
    case "gym.restored":
      return "Restored the gym";
    case "gym.status_changed":
      return d.to === "suspended" ? "Suspended the gym" : d.to === "active" ? "Made the gym active again" : `Gym status: ${str(d.to)}`;
    case "gym.settings_changed": {
      const fields = Array.isArray(d.fields) ? d.fields.map((f) => field(str(f))) : [];
      const shown = fields.slice(0, 4).join(", ");
      return `Changed gym settings${shown ? `: ${shown}${fields.length > 4 ? ` and ${fields.length - 4} more` : ""}` : ""}`;
    }
    case "poster.rotated":
      return "Made a new check-in poster code";
    case "platform.viewed_gym":
      return "Looked at this gym's details";
    case "platform.searched_people":
      return `Searched people for "${str(d.query)}"`;
    default:
      return entry.action.replace(/[._]/g, " ");
  }
}
