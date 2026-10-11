import "server-only";
import { AVATAR_BUCKET, AVATAR_URL_SECONDS } from "@gymos/shared";
import { createClient } from "@/lib/supabase/server";

// Profile photos are private: turn stored paths into signed URLs with the
// signed-in user's own client, so storage RLS decides who may see each one.
// Returns path -> URL; paths the user may not see are simply left out.
export async function signAvatars(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrls(unique, AVATAR_URL_SECONDS);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}

export async function signAvatar(path: string | null | undefined) {
  return path ? (await signAvatars([path])).get(path) ?? null : null;
}
