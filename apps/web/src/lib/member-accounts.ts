import "server-only";
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
