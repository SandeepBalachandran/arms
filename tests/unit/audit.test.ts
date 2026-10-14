import { describe, expect, it } from "vitest";
import { auditActor, auditGroup, BRAND, describeAudit } from "@gymos/shared";

describe("activity log sentences", () => {
  it("money", () => {
    expect(describeAudit({ action: "payment.recorded", details: { member: "Ravi", amount_paise: 150000, method: "cash" } })).toBe("Recorded ₹1,500 (Cash) from Ravi");
    expect(describeAudit({ action: "payment.upi_rejected", details: { member: "Ravi", amount_paise: 99900 } })).toBe("Rejected Ravi's UPI payment of ₹999");
    expect(describeAudit({ action: "membership.cancelled", details: { member: "Ravi", plan: "Monthly" } })).toBe("Cancelled Ravi's Monthly membership");
  });

  it("people and the permission grid", () => {
    expect(describeAudit({ action: "member.roles_changed", details: { member: "Tara", from: ["trainer"], to: ["trainer", "staff"] } })).toBe("Changed Tara's role from Trainer to Trainer + Staff");
    expect(describeAudit({ action: "member.status_changed", details: { member: "Ravi", from: "pending", to: "active" } })).toBe("Approved Ravi");
    expect(describeAudit({ action: "permissions.changed", details: { role: "staff", permission: "record_payments", allowed: false } })).toBe("Stopped Staff: Record payments");
    expect(describeAudit({ action: "permissions.changed", details: { role: "admin", permission: "manage_sections", allowed: false, default: true } })).toContain("to the default");
  });

  it("plans, settings and unknown actions", () => {
    expect(describeAudit({ action: "plan.updated", details: { plan: "Monthly", price_paise: 159900, from_price_paise: 149900, from_name: "Monthly", active: true } })).toBe("Changed the Monthly plan: price ₹1,499 → ₹1,599");
    expect(describeAudit({ action: "gym.settings_changed", details: { fields: ["upi_id", "upi_payee_name"] } })).toBe("Changed gym settings: upi id, upi payee name");
    expect(describeAudit({ action: "something.new", details: null })).toBe("something new");
  });

  it("groups and actors", () => {
    expect(auditGroup("payment.deleted")).toBe("money");
    expect(auditGroup("permissions.changed")).toBe("people");
    expect(auditGroup("platform.viewed_gym")).toBe("support");
    expect(auditActor({ actor_name: "Dev", actor_platform: true }, true)).toBe(`${BRAND.name} support`);
    expect(auditActor({ actor_name: "Dev", actor_platform: true }, false)).toBe("Dev (support)");
  });
});
