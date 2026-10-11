import { AVATAR_BUCKET } from '@gymos/shared';

import { supabase } from '@/lib/supabase';

// "Delete my account", as in the admin (apps/web/src/app/account/actions.ts):
// owners delete their gym first; then the photo files (storage can't be
// cleared from SQL); then the account and personal data. Gyms keep their
// payment and visit records under "Deleted member". Throws a message to show.
export async function deleteMyAccount(userId: string) {
  const { data: owned, error } = await supabase
    .from('gym_members')
    .select('gyms!inner(name, deleted_at)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .is('gyms.deleted_at', null)
    .limit(1);
  if (error) throw error;
  if (owned.length) throw new Error(`You own ${owned[0].gyms.name}. Delete the gym in Settings on the web admin first, then delete your account.`);

  const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  if (files?.length) await supabase.storage.from(AVATAR_BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
  const { error: deleteError } = await supabase.rpc('delete_my_account');
  if (deleteError) throw deleteError;
  await supabase.auth.signOut({ scope: 'local' });
}
