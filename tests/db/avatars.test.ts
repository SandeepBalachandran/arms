import { afterAll, describe, expect, it } from "vitest";
import { as, fx, refused, service } from "./fixture";

// Profile photos: private bucket, one folder per user. The person and their
// gym's team can see a photo; other members and other gyms can't.
const bucket = "avatars";
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
const member = fx.users.member.id;
const path = `${member}/test.jpg`;
const trainerPath = `${fx.users.trainer.id}/test.jpg`;

afterAll(async () => {
  await service.from("profiles").update({ avatar_url: null }).in("id", [member, fx.users.member2.id]);
  await service.from("profiles").update({ avatar_url: null }).eq("id", fx.users.trainer.id);
  await service.storage.from(bucket).remove([path, `${fx.users.member2.id}/sneaky.jpg`, trainerPath]);
});

describe("profile photos", () => {
  it("a member uploads a photo to their own folder and saves it on their profile", async () => {
    const up = await as.member.storage.from(bucket).upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    expect(up.error?.message).toBeUndefined();
    const saved = await as.member.from("profiles").update({ avatar_url: path }).eq("id", member).select("avatar_url").single();
    expect(saved.data?.avatar_url).toBe(path);
  });

  it("nobody can upload into someone else's folder", async () => {
    const res = await as.member.storage.from(bucket).upload(`${fx.users.member2.id}/sneaky.jpg`, jpeg, { contentType: "image/jpeg" });
    expect(res.error).toBeTruthy();
    const staff = await as.staff.storage.from(bucket).upload(`${member}/by-staff.jpg`, jpeg, { contentType: "image/jpeg" });
    expect(staff.error).toBeTruthy();
  });

  it("a profile can't point at someone else's photo", async () => {
    const res = await as.member2.from("profiles").update({ avatar_url: path }).eq("id", fx.users.member2.id);
    expect(res.error?.message).toMatch(/profiles_avatar_own_folder/);
  });

  it("only images, up to 2 MB", async () => {
    const pdf = await as.member.storage.from(bucket).upload(`${member}/x.pdf`, jpeg, { contentType: "application/pdf" });
    expect(pdf.error).toBeTruthy();
    const big = await as.member.storage.from(bucket).upload(`${member}/big.jpg`, new Uint8Array(2 * 1024 * 1024 + 1), { contentType: "image/jpeg" });
    expect(big.error).toBeTruthy();
  });

  it("the member and the gym's team can open it", async () => {
    for (const role of ["member", "owner", "admin", "staff", "trainer"] as const) {
      const res = await as[role].storage.from(bucket).createSignedUrl(path, 60);
      expect(res.error?.message, role).toBeUndefined();
      expect(res.data?.signedUrl, role).toContain("/avatars/");
    }
  });

  it("other members and people outside the gym can't", async () => {
    for (const role of ["member2", "outsider"] as const) {
      const res = await as[role].storage.from(bucket).createSignedUrl(path, 60);
      expect(res.error, role).toBeTruthy();
      const list = await as[role].storage.from(bucket).list(member);
      expect(list.data ?? [], role).toEqual([]);
    }
  });

  it("no public link works", async () => {
    const { data } = service.storage.from(bucket).getPublicUrl(path);
    expect((await fetch(data.publicUrl)).ok).toBe(false);
  });

  it("only the owner of the folder can delete or replace it", async () => {
    expect(refused(await as.staff.storage.from(bucket).remove([path]))).toBe(true);
    expect(refused(await as.member2.storage.from(bucket).remove([path]))).toBe(true);
    expect((await service.storage.from(bucket).list(member)).data?.map((f) => f.name)).toContain("test.jpg");
    const replace = await as.staff.storage.from(bucket).update(path, jpeg, { contentType: "image/jpeg" });
    expect(replace.error).toBeTruthy();
  });

  it("members see their gym team's photos (to know their trainer), not other gyms'", async () => {
    expect((await as.trainer.storage.from(bucket).upload(trainerPath, jpeg, { contentType: "image/jpeg", upsert: true })).error).toBeNull();
    await as.trainer.from("profiles").update({ avatar_url: trainerPath }).eq("id", fx.users.trainer.id);
    for (const role of ["member", "member2"] as const) {
      expect((await as[role].storage.from(bucket).createSignedUrl(trainerPath, 60)).error, role).toBeNull();
    }
    expect((await as.outsider.storage.from(bucket).createSignedUrl(trainerPath, 60)).error).toBeTruthy();
  });
});
