"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireGym } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const LOGO_BUCKET = "gym-logos";
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

type Admin = ReturnType<typeof createAdminClient>;

// Public bucket (logos show on the join page and in the app). Made on first
// use so a fresh project needs no manual setup.
async function ensureBucket(admin: Admin) {
  const { error } = await admin.storage.getBucket(LOGO_BUCKET);
  if (!error) return;
  await admin.storage.createBucket(LOGO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(TYPES),
  });
}

function storedPath(url: string | null) {
  const marker = `/object/public/${LOGO_BUCKET}/`;
  return url?.includes(marker) ? url.slice(url.indexOf(marker) + marker.length) : null;
}

// Owners and admins. The file goes up with the service key after the role
// check; the new URL is saved through RLS like any other setting.
export async function uploadLogo(formData: FormData): Promise<ActionResult> {
  const slug = z.string().parse(formData.get("slug"));
  const file = formData.get("logo");
  const { gym } = await requireGym(slug, ["owner", "admin"]);
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image" };
  const ext = TYPES[file.type];
  if (!ext) return { error: "Use a PNG, JPG or WebP image" };
  if (file.size > MAX_BYTES) return { error: "The image must be 2 MB or smaller" };

  const admin = createAdminClient();
  await ensureBucket(admin);
  // A new name each time, so phones and browsers don't keep showing the old logo.
  const path = `${gym.id}/logo-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage.from(LOGO_BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };
  const { data } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);

  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ logo_url: data.publicUrl }).eq("id", gym.id);
  if (error) return { error: error.message };

  const old = storedPath(gym.logo_url);
  if (old) await admin.storage.from(LOGO_BUCKET).remove([old]);
  revalidatePath(`/admin/${slug}`, "layout");
}

export async function removeLogo(formData: FormData): Promise<ActionResult> {
  const slug = z.string().parse(formData.get("slug"));
  const { gym } = await requireGym(slug, ["owner", "admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("gyms").update({ logo_url: null }).eq("id", gym.id);
  if (error) return { error: error.message };
  const old = storedPath(gym.logo_url);
  if (old) await createAdminClient().storage.from(LOGO_BUCKET).remove([old]);
  revalidatePath(`/admin/${slug}`, "layout");
}
