"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EXERCISE_MEDIA_BUCKET,
  EXERCISE_PHOTO_MAX_BYTES,
  HOW_TO_MAX,
  MAX_EXERCISE_PHOTOS,
  videoLink,
} from "@gymos/shared";
import type { ActionResult } from "@/lib/action-result";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Exercise guides: photos, a video link and how-to text. The team (owner,
// admin, staff, trainers) edits them; RLS enforces the same.

export type GuideState = { error?: string; saved?: boolean } | undefined;

type Admin = ReturnType<typeof createAdminClient>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

// Public bucket, made on first use like gym logos: equipment photos aren't
// personal data and members' phones can cache them.
async function ensureBucket(admin: Admin) {
  const { error } = await admin.storage.getBucket(EXERCISE_MEDIA_BUCKET);
  if (!error) return;
  await admin.storage.createBucket(EXERCISE_MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: EXERCISE_PHOTO_MAX_BYTES,
    allowedMimeTypes: ["image/jpeg"],
  });
}

function storedPath(url: string) {
  const marker = `/object/public/${EXERCISE_MEDIA_BUCKET}/`;
  return url.includes(marker) ? url.slice(url.indexOf(marker) + marker.length) : null;
}

async function currentGuide(supabase: Supabase, gymId: string, exerciseId: string) {
  const { data, error } = await supabase
    .from("exercise_media")
    .select("photo_urls, video_url, how_to_en, how_to_ml")
    .eq("gym_id", gymId)
    .eq("exercise_id", exerciseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const text = z
  .string()
  .trim()
  .max(HOW_TO_MAX, `Keep it under ${HOW_TO_MAX} characters`)
  .transform((v) => v || null);

export async function saveGuide(_prev: GuideState, formData: FormData): Promise<GuideState> {
  const parsed = z
    .object({
      slug: z.string(),
      exercise_id: z.uuid(),
      video_url: z
        .string()
        .trim()
        .transform((v) => v || null)
        .refine((v) => v === null || videoLink(v) !== null, "Paste a full https:// link, e.g. from YouTube or Instagram"),
      how_to_en: text,
      how_to_ml: text,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, exercise_id, video_url, ...howTo } = parsed.data;
  const { gym, memberId } = await requireGym(slug, TEAM_ROLES);

  const supabase = await createClient();
  const { error } = await supabase.from("exercise_media").upsert({
    gym_id: gym.id,
    exercise_id,
    video_url: video_url ? videoLink(video_url)!.url : null,
    ...howTo,
    updated_by: memberId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/workouts`, "layout");
  return { saved: true };
}

// The browser resizes the photo to a JPEG first (see guide-photos.tsx).
export async function uploadExercisePhoto(formData: FormData): Promise<ActionResult> {
  const { slug, exercise_id } = z.object({ slug: z.string(), exercise_id: z.uuid() }).parse({
    slug: formData.get("slug"),
    exercise_id: formData.get("exercise_id"),
  });
  const file = formData.get("photo");
  const { gym, memberId } = await requireGym(slug, TEAM_ROLES);
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo" };
  if (file.type !== "image/jpeg") return { error: "Couldn't read that photo" };
  if (file.size > EXERCISE_PHOTO_MAX_BYTES) return { error: "The photo must be 2 MB or smaller" };

  const supabase = await createClient();
  const guide = await currentGuide(supabase, gym.id, exercise_id);
  const photos = guide?.photo_urls ?? [];
  if (photos.length >= MAX_EXERCISE_PHOTOS) return { error: `Up to ${MAX_EXERCISE_PHOTOS} photos. Remove one first.` };

  const admin = createAdminClient();
  await ensureBucket(admin);
  const path = `${gym.id}/${exercise_id}-${Date.now()}.jpg`;
  const { error: uploadError } = await admin.storage.from(EXERCISE_MEDIA_BUCKET).upload(path, file, { contentType: "image/jpeg" });
  if (uploadError) return { error: uploadError.message };
  const { data } = admin.storage.from(EXERCISE_MEDIA_BUCKET).getPublicUrl(path);

  // Saved through RLS, so only the gym's team can attach photos.
  const { error } = await supabase.from("exercise_media").upsert({
    gym_id: gym.id,
    exercise_id,
    photo_urls: [...photos, data.publicUrl],
    updated_by: memberId,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    await admin.storage.from(EXERCISE_MEDIA_BUCKET).remove([path]);
    return { error: error.message };
  }
  revalidatePath(`/admin/${slug}/workouts`, "layout");
}

export async function removeExercisePhoto(formData: FormData): Promise<ActionResult> {
  const { slug, exercise_id, url } = z
    .object({ slug: z.string(), exercise_id: z.uuid(), url: z.string() })
    .parse(Object.fromEntries(formData));
  const { gym, memberId } = await requireGym(slug, TEAM_ROLES);
  const supabase = await createClient();
  const guide = await currentGuide(supabase, gym.id, exercise_id);
  if (!guide?.photo_urls.includes(url)) return;

  const { error } = await supabase
    .from("exercise_media")
    .update({ photo_urls: guide.photo_urls.filter((u) => u !== url), updated_by: memberId, updated_at: new Date().toISOString() })
    .eq("gym_id", gym.id)
    .eq("exercise_id", exercise_id);
  if (error) return { error: error.message };
  const path = storedPath(url);
  if (path?.startsWith(`${gym.id}/`)) await createAdminClient().storage.from(EXERCISE_MEDIA_BUCKET).remove([path]);
  revalidatePath(`/admin/${slug}/workouts`, "layout");
}
