import "server-only";
import { isPlaceholderEmail, placeholderEmail } from "@gymos/shared";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// Finds the person's login by email or phone, or creates one (confirmed, no
// password) so staff can add people who don't have the app yet. With an email
// they can later sign in to the app with a code and see their membership.
export async function findOrCreateUser(
  admin: Admin,
  { full_name, email, phone, intlPhone }: { full_name: string; email: string; phone: string; intlPhone: string | null },
): Promise<{ userId: string; error?: undefined } | { userId?: undefined; error: string }> {
  const { data: existingId, error: findError } = await admin.rpc("find_user_id", {
    ...(email ? { p_email: email } : {}),
    ...(intlPhone ? { p_phone: intlPhone } : {}),
  });
  if (findError) return { error: findError.message };
  if (existingId) return { userId: existingId };

  const { data, error } = await admin.auth.admin.createUser({
    ...(email ? { email, email_confirm: true } : {}),
    ...(intlPhone ? { phone: `+${intlPhone}`, phone_confirm: true } : {}),
    user_metadata: { full_name },
  });
  if (error) return { error: error.message };
  await admin.from("profiles").update({ full_name, phone: phone || null }).eq("id", data.user.id);
  return { userId: data.user.id };
}

/**
 * Null when this gym's staff may change the person's sign-in (email, phone,
 * PIN); otherwise why not. Only an ordinary member of this gym alone, so
 * staff can never take over a team account or a membership at another gym.
 */
export async function signInLockedReason(admin: Admin, userId: string, gymId: string): Promise<string | null> {
  const { data, error } = await admin.from("gym_members").select("gym_id, role, extra_roles").eq("user_id", userId);
  if (error) return error.message;
  if (data.some((r) => r.role !== "member" || r.extra_roles.length > 0)) return "Team members manage their own sign-in.";
  if (data.some((r) => r.gym_id !== gymId)) return "This person also uses the app at another gym, so they manage their own sign-in.";
  return null;
}

const takenMessage = (message: string) =>
  /phone/i.test(message) && /(exist|registered|already)/i.test(message)
    ? "That phone number is already used by another account."
    : /(exist|registered|already)/i.test(message)
      ? "That email is already used by another account."
      : message;

/**
 * Keeps the login in step with what staff typed: the phone (and a phone-only
 * member's placeholder email, which follows it) and a new email. Call only
 * when signInLockedReason() is null.
 */
export async function syncSignIn(
  admin: Admin,
  userId: string,
  { intlPhone, email }: { intlPhone: string | null; email: string | null },
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return error.message;
  const user = data.user;
  const changes: { phone?: string; phone_confirm?: boolean; email?: string; email_confirm?: boolean } = {};
  if (intlPhone && user.phone !== intlPhone) Object.assign(changes, { phone: `+${intlPhone}`, phone_confirm: true });
  if (email && email.toLowerCase() !== user.email?.toLowerCase()) Object.assign(changes, { email, email_confirm: true });
  else if (intlPhone && isPlaceholderEmail(user.email) && user.email !== placeholderEmail(intlPhone)) {
    Object.assign(changes, { email: placeholderEmail(intlPhone), email_confirm: true });
  }
  if (!Object.keys(changes).length) return null;
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, changes);
  return updateError ? takenMessage(updateError.message) : null;
}

/** Sets a new PIN (their password); a phone-only member gets a placeholder email for it. */
export async function setPin(admin: Admin, userId: string, intlPhone: string, pin: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) return error.message;
  const user = data.user;
  const changes: { password: string; phone?: string; phone_confirm?: boolean; email?: string; email_confirm?: boolean } = { password: pin };
  if (user.phone !== intlPhone) Object.assign(changes, { phone: `+${intlPhone}`, phone_confirm: true });
  if (!user.email || (isPlaceholderEmail(user.email) && user.email !== placeholderEmail(intlPhone))) {
    Object.assign(changes, { email: placeholderEmail(intlPhone), email_confirm: true });
  }
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, changes);
  if (updateError) return takenMessage(updateError.message);
  const { error: profileError } = await admin.from("profiles").update({ pin_set_at: new Date().toISOString() }).eq("id", userId);
  return profileError?.message ?? null;
}
