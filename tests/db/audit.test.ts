import { afterAll, describe, expect, it } from "vitest";
import { as, fx, memberId, refused, service } from "./fixture";

const gymId = fx.gym.id;

// Platform admin rights are given to the outsider only for the platform tests.
const setPlatformAdmin = async (on: boolean) => {
  const { error } = await service.from("profiles").update({ is_platform_admin: on }).eq("id", fx.users.outsider.id);
  if (error) throw error;
};

afterAll(async () => {
  await setPlatformAdmin(false);
  await service.from("gym_role_permissions").delete().eq("gym_id", gymId);
  await service.from("gym_members").update({ extra_roles: [] }).eq("id", memberId("trainer"));
  await service.from("gyms").update({ status: "active" }).eq("id", gymId);
});

const latest = async (action: string) => {
  const { data, error } = await as.owner.rpc("audit_entries", { p_gym_id: gymId, p_limit: 100 });
  expect(error?.message).toBeUndefined();
  return data!.find((e) => e.action === action);
};

describe("audit log", () => {
  it("records a payment at the desk, with who did it", async () => {
    const { error } = await as.staff.rpc("record_manual_payment", { p_member_id: memberId("member2"), p_plan_id: fx.planId, p_method: "cash" });
    expect(error?.message).toBeUndefined();
    const entry = await latest("payment.recorded");
    expect(entry).toMatchObject({ actor_platform: false });
    expect(entry!.actor_name).not.toMatch(/^(System|Someone)$/);
    expect(entry!.details).toMatchObject({ amount_paise: 150000, method: "cash" });
  });

  it("records role and permission changes", async () => {
    await as.owner.from("gym_members").update({ extra_roles: ["staff"] }).eq("id", memberId("trainer"));
    expect((await latest("member.roles_changed"))!.details).toMatchObject({ from: ["trainer"], to: ["trainer", "staff"] });

    await as.owner.from("gym_role_permissions").upsert({ gym_id: gymId, role: "staff", permission: "manage_classes", allowed: false });
    expect((await latest("permissions.changed"))!.details).toMatchObject({ role: "staff", permission: "manage_classes", allowed: false });
  });

  it("only the owner reads it, and nobody writes it directly", async () => {
    expect(refused(await as.admin.rpc("audit_entries", { p_gym_id: gymId }))).toBe(true);
    expect((await as.staff.from("audit_log").select("id").eq("gym_id", gymId)).data).toEqual([]);
    expect((await as.owner.from("audit_log").select("id").eq("gym_id", gymId)).data!.length).toBeGreaterThan(0);

    const forged = await as.owner.from("audit_log").insert({ gym_id: gymId, action: "payment.recorded" }).select("id");
    expect(refused(forged)).toBe(true);
    const wiped = await as.owner.from("audit_log").delete().eq("gym_id", gymId).select("id");
    expect(refused(wiped)).toBe(true);
  });
});

describe("platform view", () => {
  it("is refused to everyone but platform admins, owners included", async () => {
    expect(refused(await as.owner.rpc("platform_gyms"))).toBe(true);
    expect(refused(await as.outsider.rpc("platform_gym", { p_gym_id: gymId }))).toBe(true);
    expect(refused(await as.owner.rpc("platform_find_people", { p_query: "test" }))).toBe(true);
    expect(refused(await as.owner.rpc("platform_set_gym_status", { p_gym_id: gymId, p_status: "suspended" }))).toBe(true);
  });

  it("lists gyms, shows one (and the owner sees that support looked), finds people", async () => {
    await setPlatformAdmin(true);
    const gyms = await as.outsider.rpc("platform_gyms");
    expect(gyms.error?.message).toBeUndefined();
    const mine = gyms.data!.find((g) => g.id === gymId);
    expect(mine).toMatchObject({ slug: fx.gym.slug, owner_email: fx.users.owner.email });
    expect(mine!.members).toBeGreaterThan(0);

    const gym = await as.outsider.rpc("platform_gym", { p_gym_id: gymId });
    expect(gym.error?.message).toBeUndefined();
    expect((gym.data as { team: { email: string }[] }).team.map((t) => t.email)).toContain(fx.users.owner.email);
    expect(await latest("platform.viewed_gym")).toMatchObject({ actor_platform: true });

    const people = await as.outsider.rpc("platform_find_people", { p_query: fx.users.member.email });
    expect(people.data!.map((p) => p.gym_id)).toContain(gymId);
  });

  it("suspends and reactivates a gym", async () => {
    await setPlatformAdmin(true);
    expect((await as.outsider.rpc("platform_set_gym_status", { p_gym_id: gymId, p_status: "suspended" })).error?.message).toBeUndefined();
    expect((await service.from("gyms").select("status").eq("id", gymId).single()).data!.status).toBe("suspended");
    expect((await as.outsider.rpc("platform_set_gym_status", { p_gym_id: gymId, p_status: "active" })).error?.message).toBeUndefined();
    expect(await latest("gym.status_changed")).toMatchObject({ actor_platform: true });
  });
});
