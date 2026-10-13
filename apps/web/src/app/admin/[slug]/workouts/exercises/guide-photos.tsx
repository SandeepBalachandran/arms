"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useRef, useTransition } from "react";
import toast from "react-hot-toast";
import { EXERCISE_PHOTO_MAX_SIDE, MAX_EXERCISE_PHOTOS } from "@gymos/shared";
import { removeExercisePhoto, uploadExercisePhoto } from "./actions";

// Shrinks a photo so its longest side is at most EXERCISE_PHOTO_MAX_SIDE and
// saves it as JPEG. iPhone photos (HEIC) only open natively in Safari, so
// they're converted first.
async function toJpeg(file: File): Promise<Blob> {
  const heic = /\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]/.test(file.type);
  const bitmap = heic
    ? await (await import("heic-to/next")).heicTo({ blob: file, type: "bitmap" })
    : await createImageBitmap(file);
  const scale = Math.min(1, EXERCISE_PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read the photo"))), "image/jpeg", 0.85),
  );
}

export function GuidePhotos({ slug, exerciseId, exerciseName, photos }: { slug: string; exerciseId: string; exerciseName: string; photos: string[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("slug", slug);
        fd.set("exercise_id", exerciseId);
        fd.set("photo", new File([await toJpeg(file)], "photo.jpg", { type: "image/jpeg" }));
        const result = await uploadExercisePhoto(fd);
        if (result?.error) toast.error(result.error);
        else toast.success("Photo added");
      } catch (error) {
        unstable_rethrow(error);
        toast.error("Couldn't open that image. Use a JPG, PNG, WebP or iPhone (HEIC) photo.");
      }
      if (input.current) input.current.value = "";
    });
  }

  function remove(url: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("slug", slug);
      fd.set("exercise_id", exerciseId);
      fd.set("url", url);
      const result = await removeExercisePhoto(fd);
      if (result?.error) toast.error(result.error);
      else toast.success("Photo removed");
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {photos.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element -- user upload on Supabase Storage */}
            <img src={url} alt={`${exerciseName}, photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(url)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 disabled:opacity-50"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {photos.length < MAX_EXERCISE_PHOTOS && (
          <button
            type="button"
            disabled={pending}
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-sm text-muted hover:bg-border/30 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            {pending ? "Saving…" : "Add photo"}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        Up to {MAX_EXERCISE_PHOTOS} photos of the machine or the starting position. Phone photos are fine; they&apos;re resized automatically.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
    </div>
  );
}
