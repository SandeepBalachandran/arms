import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteAccount, signedIn, TEST_PASSWORD } from "../support/test-gym";
import { as, fx, service } from "./fixture";

// "Delete my account": the sign-in account and personal/health data go; the
// gym keeps payments, memberships and visits under "Deleted member".
const email = `t${fx.run}.leaver@gymos.test`;
let userId: string;
let memberId: string;

beforeAll(async () => {
  const { data, error } = await service.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true, user_metadata: { full_name: "Lena Leaver" } });
  if (error) throw error;
  userId = data.user.id;
  await service.from("profiles").update({ full_name: "Lena Leaver", phone: "9876500000" }).eq("id", userId);
  const member = await service.from("gym_members").insert({ gym_id: fx.gym.id, user_id: userId, role: "member", status: "active" }).select("id").single();
  memberId = member.data!.id;

  const sub = await service.from("subscriptions").insert({ gym_id: fx.gym.id, member_id: memberId, plan_id: fx.planId, plan_name: "Monthly", price_paise: 150000, starts_on: "2026-01-01", ends_on: "2026-01-30" }).select("id").single();
  await service.from("payments").insert({ gym_id: fx.gym.id, member_id: memberId, subscription_id: sub.data!.id, plan_id: fx.planId, amount_paise: 150000, method: "cash", status: "paid", paid_at: new Date().toISOString() });
  await service.from("checkins").insert({ gym_id: fx.gym.id, member_id: memberId, method: "manual", membership_ok: true });
  await service.from("body_metrics").insert({ gym_id: fx.gym.id, member_id: memberId, measured_on: "2026-01-02", weight_kg: 70 });
  await service.from("food_logs").insert({ gym_id: fx.gym.id, member_id: memberId, logged_on: "2026-01-02", meal: "breakfast", name: "Puttu", servings: 1, kcal: 200, protein_g: 4, carbs_g: 40, fat_g: 1 });
  await service.from("member_notes").insert({ gym_id: fx.gym.id, member_id: memberId, body: "Knee injury", author_id: fx.users.owner.id });
  await service.storage.from("avatars").upload(`${userId}/1.jpg`, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { contentType: "image/jpeg" });
  await service.from("profiles").update({ avatar_url: `${userId}/1.jpg` }).eq("id", userId);
});

afterAll(async () => {
  if (userId) await deleteAccount(service, userId);
});

const count = async (table: "payments" | "subscriptions" | "checkins" | "body_metrics" | "food_logs" | "member_notes") =>
  (await service.from(table).select("*", { count: "exact", head: true }).eq("member_id", memberId)).count;

describe("delete my account", () => {
  it("a gym owner must delete the gym first", async () => {
    const res = await as.owner.rpc("delete_my_account");
    expect(res.error?.message).toMatch(/You own Test Gym .+\. Delete the gym in Settings first/);
    expect((await service.auth.admin.getUserById(fx.users.owner.id)).data.user).toBeTruthy();
  });

  it("signed out callers can't delete anything", async () => {
    const { anonClient } = await import("./env");
    expect((await anonClient().rpc("delete_my_account")).error).toBeTruthy();
  });

  it("a member deletes their account: sign-in and personal data go, the gym's records stay", async () => {
    const { client } = await signedIn(email);
    // The apps clear the photo folder first, through storage RLS.
    expect((await client.storage.from("avatars").remove([`${userId}/1.jpg`])).error).toBeNull();
    const res = await client.rpc("delete_my_account");
    expect(res.error?.message).toBeUndefined();

    expect((await service.auth.admin.getUserById(userId)).data.user).toBeNull();
    expect((await service.auth.signInWithPassword({ email, password: TEST_PASSWORD })).error).toBeTruthy();

    const { data: profile } = await service.from("profiles").select("full_name, phone, avatar_url, deleted_at").eq("id", userId).single();
    expect(profile).toMatchObject({ full_name: "Deleted member", phone: null, avatar_url: null });
    expect(profile!.deleted_at).toBeTruthy();
    expect((await service.storage.from("avatars").list(userId)).data).toEqual([]);

    expect(await count("food_logs")).toBe(0);
    expect(await count("body_metrics")).toBe(0);
    expect(await count("member_notes")).toBe(0);
    expect(await count("payments")).toBe(1);
    expect(await count("subscriptions")).toBe(1);
    expect(await count("checkins")).toBe(1);

    const { data: member } = await service.from("gym_members").select("status").eq("id", memberId).single();
    expect(member!.status).toBe("inactive");
  });

  it("the front desk still sees the payment, under \"Deleted member\"", async () => {
    const { data } = await as.staff.from("payments").select("amount_paise, gym_members!inner(profiles!inner(full_name))").eq("member_id", memberId);
    expect(data).toEqual([{ amount_paise: 150000, gym_members: { profiles: { full_name: "Deleted member" } } }]);
  });
});
