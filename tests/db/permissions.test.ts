import { afterAll, afterEach, describe, expect, it } from "vitest";
import { as, fx, memberId, refused, service, setGym } from "./fixture";

const gymId = fx.gym.id;

// The owner edits a grid of what each role may do; the defaults match how
// the gym worked before, except gym settings and sections (owner-only).
async function setPermission(role: "admin" | "staff" | "trainer" | "member", permission: string, allowed: boolean) {
  const { error } = await as.owner.from("gym_role_permissions").upsert({ gym_id: gymId, role, permission, allowed });
  expect(error?.message).toBeUndefined();
}

afterEach(async () => {
  await service.from("gym_role_permissions").delete().eq("gym_id", gymId);
});

afterAll(async () => {
  for (const role of ["admin", "staff", "trainer", "member"] as const) {
    await service.from("gym_members").update({ extra_roles: [] }).eq("id", memberId(role));
  }
  await service.from("gym_members").update({ extra_roles: [] }).eq("id", memberId("owner"));
  await service.from("class_types").delete().eq("gym_id", gymId).like("name", "TEST perm%");
});

const classType = (name: string) => ({ gym_id: gymId, name, default_capacity: 10, default_duration_min: 45 });

describe("defaults", () => {
  it("match how the gym worked before", async () => {
    const perms = async (role: "admin" | "staff" | "trainer" | "member") => (await as[role].rpc("my_permissions", { p_gym_id: gymId })).data;
    expect(await perms("staff")).toEqual(expect.arrayContaining(["manage_members", "record_payments", "confirm_upi", "check_in_members", "manage_classes"]));
    expect(await perms("staff")).not.toContain("manage_plans_pricing");
    expect(await perms("trainer")).toEqual(expect.arrayContaining(["edit_workout_plans", "assign_workout_plans", "coach_nutrition"]));
    expect(await perms("trainer")).not.toContain("record_payments");
    expect(await perms("member")).toEqual(["book_classes", "log_food", "log_workouts", "self_check_in"]);
  });

  it("the owner has everything; settings and sections are owner-only by default", async () => {
    const owner = (await as.owner.rpc("my_permissions", { p_gym_id: gymId })).data!;
    expect(owner).toHaveLength(20);
    const admin = (await as.admin.rpc("my_permissions", { p_gym_id: gymId })).data!;
    expect(admin).not.toContain("edit_gym_settings");
    expect(admin).not.toContain("manage_sections");
  });
});

describe("the owner's grid", () => {
  it("revoking a permission blocks the action; granting one allows it", async () => {
    expect((await as.staff.from("class_types").insert(classType("TEST perm yoga")).select("id")).error?.message).toBeUndefined();
    await setPermission("staff", "manage_classes", false);
    expect(refused(await as.staff.from("class_types").insert(classType("TEST perm zumba")).select("id"))).toBe(true);

    expect(refused(await as.trainer.from("class_types").insert(classType("TEST perm spin")).select("id"))).toBe(true);
    await setPermission("trainer", "manage_classes", true);
    expect((await as.trainer.from("class_types").insert(classType("TEST perm spin")).select("id")).error?.message).toBeUndefined();
  });

  it("works for members too", async () => {
    await setPermission("member", "log_workouts", false);
    const res = await as.member.from("workout_logs").insert({ gym_id: gymId, member_id: memberId("member") }).select("id");
    expect(refused(res)).toBe(true);
  });

  it("only the owner edits it, and the owner can't be denied anything", async () => {
    expect(refused(await as.admin.from("gym_role_permissions").insert({ gym_id: gymId, role: "staff", permission: "manage_members", allowed: false }).select("gym_id"))).toBe(true);
    expect((await as.owner.from("gym_role_permissions").insert({ gym_id: gymId, role: "owner", permission: "manage_members", allowed: false })).error).not.toBeNull();
    expect((await as.owner.rpc("has_permission", { p_gym_id: gymId, p_permission: "manage_sections" })).data).toBe(true);
  });

  it("the full grid is only for the owner, unless they let someone manage roles", async () => {
    expect((await as.owner.rpc("permission_grid", { p_gym_id: gymId })).data).toHaveLength(4 * 20);
    expect((await as.admin.rpc("permission_grid", { p_gym_id: gymId })).data).toEqual([]);
    await setPermission("admin", "manage_roles", true);
    expect((await as.admin.rpc("permission_grid", { p_gym_id: gymId })).data).toHaveLength(4 * 20);
  });

  it("someone who manages roles can't change their own role's column or who manages roles", async () => {
    await setPermission("admin", "manage_roles", true);
    const cell = async (role: "admin" | "staff" | "trainer", permission: string) =>
      (await as.admin.rpc("permission_grid", { p_gym_id: gymId })).data!.find((c) => c.role === role && c.permission === permission)!.editable;
    expect(await cell("staff", "record_payments")).toBe(true);
    expect(await cell("admin", "record_payments")).toBe(false);
    expect(await cell("trainer", "manage_roles")).toBe(false);

    const staffCell = await as.admin.from("gym_role_permissions").upsert({ gym_id: gymId, role: "staff", permission: "record_payments", allowed: false }).select("gym_id");
    expect(staffCell.error?.message).toBeUndefined();
    expect((await as.staff.rpc("has_permission", { p_gym_id: gymId, p_permission: "record_payments" })).data).toBe(false);

    expect(refused(await as.admin.from("gym_role_permissions").upsert({ gym_id: gymId, role: "admin", permission: "edit_gym_settings", allowed: true }).select("gym_id"))).toBe(true);
    expect(refused(await as.admin.from("gym_role_permissions").upsert({ gym_id: gymId, role: "staff", permission: "manage_roles", allowed: true }).select("gym_id"))).toBe(true);
    expect((await as.admin.rpc("has_permission", { p_gym_id: gymId, p_permission: "edit_gym_settings" })).data).toBe(false);
  });

  it("the owner can take it away again", async () => {
    await setPermission("admin", "manage_roles", true);
    await setPermission("admin", "manage_roles", false);
    expect(refused(await as.admin.from("gym_role_permissions").upsert({ gym_id: gymId, role: "staff", permission: "manage_members", allowed: false }).select("gym_id"))).toBe(true);
  });
});

describe("gym settings and sections", () => {
  it("an admin can't turn sections on or off until the owner allows it", async () => {
    await setGym({ classes_enabled: true });
    expect((await as.admin.from("gyms").update({ classes_enabled: false }).eq("id", gymId)).error?.message).toMatch(/sections/);
    await setPermission("admin", "manage_sections", true);
    expect((await as.admin.from("gyms").update({ classes_enabled: false }).eq("id", gymId)).error?.message).toBeUndefined();
    await setGym({ classes_enabled: true });
  });

  it("an admin can't change gym settings until the owner allows it", async () => {
    await setGym({ workouts_enabled: true });
    expect((await as.admin.from("gyms").update({ phone: "9000000001" }).eq("id", gymId)).error?.message).toMatch(/settings/);
    await setPermission("admin", "edit_gym_settings", true);
    expect((await as.admin.from("gyms").update({ phone: "9000000001" }).eq("id", gymId)).error?.message).toBeUndefined();
    // Settings permission alone doesn't cover sections.
    expect((await as.admin.from("gyms").update({ workouts_enabled: false }).eq("id", gymId)).error?.message).toMatch(/sections/);
  });

  it("the owner can always do both", async () => {
    expect((await as.owner.from("gyms").update({ phone: "9000000002", pt_enabled: true }).eq("id", gymId)).error?.message).toBeUndefined();
  });
});

describe("more than one role", () => {
  it("a trainer who is also front desk gets both sets of rights", async () => {
    expect((await as.trainer.rpc("my_permissions", { p_gym_id: gymId })).data).not.toContain("record_payments");
    expect((await as.owner.rpc("set_member_roles", { p_member_id: memberId("trainer"), p_role: "trainer", p_extra_roles: ["staff"] })).error?.message).toBeUndefined();
    const perms = (await as.trainer.rpc("my_permissions", { p_gym_id: gymId })).data!;
    expect(perms).toEqual(expect.arrayContaining(["record_payments", "edit_workout_plans"]));
  });

  it("the owner can also be a trainer, but stays owner", async () => {
    expect((await as.owner.rpc("set_member_roles", { p_member_id: memberId("owner"), p_role: "owner", p_extra_roles: ["trainer"] })).error?.message).toBeUndefined();
    expect((await service.from("gym_members").select("role, extra_roles").eq("id", memberId("owner")).single()).data).toEqual({ role: "owner", extra_roles: ["trainer"] });
    expect((await as.owner.rpc("set_member_roles", { p_member_id: memberId("owner"), p_role: "admin", p_extra_roles: [] })).error?.message).toMatch(/stays owner/);
  });

  it("only the owner makes admins, and nobody else touches the owner", async () => {
    expect((await as.staff.rpc("set_member_roles", { p_member_id: memberId("member2"), p_role: "member", p_extra_roles: ["admin"] })).error?.message).toMatch(/owner/);
    expect((await as.admin.rpc("set_member_roles", { p_member_id: memberId("owner"), p_role: "owner", p_extra_roles: [] })).error?.message).toMatch(/owner/);
    expect((await as.staff.rpc("set_member_roles", { p_member_id: memberId("member2"), p_role: "owner", p_extra_roles: [] })).error?.message).toMatch(/ownership/);
  });

  it("without manage_members, you can't change roles", async () => {
    await setPermission("staff", "manage_members", false);
    expect((await as.staff.rpc("set_member_roles", { p_member_id: memberId("member2"), p_role: "member", p_extra_roles: ["trainer"] })).error?.message).toMatch(/can't change roles/);
  });
});
