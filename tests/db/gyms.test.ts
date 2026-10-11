import { afterAll, describe, expect, it } from "vitest";
import { as, fx, service } from "./fixture";

// Registering, deleting and restoring a gym. Uses a second throwaway gym owned
// by the "outsider" account, so the shared test gym stays intact.
const slug = `test-${fx.run}-b`;
let gymId: string;

afterAll(async () => {
  if (gymId) await service.from("gyms").delete().eq("id", gymId);
});

describe("registering", () => {
  it("anyone signed in can register a gym and becomes its owner", async () => {
    const { data, error } = await as.outsider.rpc("register_gym", { p_name: "Second Test Gym", p_slug: slug });
    expect(error?.message).toBeUndefined();
    gymId = data!;
    const { data: row } = await as.outsider.from("gym_members").select("role").eq("gym_id", gymId).single();
    expect(row!.role).toBe("owner");
  });

  it("gym codes are unique", async () => {
    const { error } = await as.member.rpc("register_gym", { p_name: "Copycat", p_slug: slug });
    expect(error).not.toBeNull();
  });
});

describe("deleting and restoring", () => {
  it("only the owner can delete, and must type the gym code", async () => {
    expect((await as.member.rpc("delete_gym", { p_gym_id: gymId, p_confirm: slug })).error?.message).toMatch(/Only an owner/);
    expect((await as.outsider.rpc("delete_gym", { p_gym_id: gymId, p_confirm: "wrong" })).error?.message).toMatch(/Type the gym code/);
  });

  it("deleting closes the gym: nobody can join it", async () => {
    expect((await as.outsider.rpc("delete_gym", { p_gym_id: gymId, p_confirm: slug })).error?.message).toBeUndefined();
    const { data } = await service.from("gyms").select("status, deleted_at").eq("id", gymId).single();
    expect(data!.status).toBe("suspended");
    expect(data!.deleted_at).not.toBeNull();
    expect((await as.member.rpc("join_gym", { p_slug: slug })).error?.message).toMatch(/Gym not found/);
  });

  it("the owner can't undo it by editing the gym directly", async () => {
    await as.outsider.from("gyms").update({ status: "active", deleted_at: null }).eq("id", gymId);
    const { data } = await service.from("gyms").select("status").eq("id", gymId).single();
    expect(data!.status).toBe("suspended");
  });

  it("only the owner can restore it", async () => {
    expect((await as.member.rpc("restore_gym", { p_gym_id: gymId })).error?.message).toMatch(/Only an owner/);
    expect((await as.outsider.rpc("restore_gym", { p_gym_id: gymId })).error?.message).toBeUndefined();
    const { data } = await service.from("gyms").select("status, deleted_at").eq("id", gymId).single();
    expect(data).toEqual({ status: "active", deleted_at: null });
  });

  it("can't be restored after 30 days", async () => {
    await service.from("gyms").update({ status: "suspended", deleted_at: new Date(Date.now() - 31 * 86400_000).toISOString() }).eq("id", gymId);
    expect((await as.outsider.rpc("restore_gym", { p_gym_id: gymId })).error?.message).toMatch(/no longer be restored/);
  });
});
