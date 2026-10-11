"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { AVATAR_SIZE } from "@gymos/shared";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { removeAvatar, uploadAvatar } from "@/app/admin/[slug]/avatar-actions";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";

// Crops the middle square of an image or video frame, shrinks it to
// AVATAR_SIZE and returns a JPEG, so uploads stay small (~40 KB).
function toSquareJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const side = Math.min(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  canvas.getContext("2d")!.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read the photo"))), "image/jpeg", 0.85),
  );
}

// The photo with a camera button; opens a dialog to upload, take or remove.
// memberId: the front desk setting a member's photo. Without it, your own.
export function AvatarEditor({
  slug,
  memberId,
  name,
  src,
  size = "lg",
}: {
  slug: string;
  memberId?: string;
  name: string;
  src: string | null;
  size?: "lg" | "xl";
}) {
  const [open, setOpen] = useState(false);
  const [camera, setCamera] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const whose = memberId ? `${name.split(" ")[0] || "the member"}'s` : "your";

  function send(photo: Blob | null) {
    const fd = new FormData();
    fd.set("slug", slug);
    if (memberId) fd.set("member_id", memberId);
    if (photo) fd.set("photo", new File([photo], "photo.jpg", { type: "image/jpeg" }));
    startTransition(async () => {
      try {
        const result = await (photo ? uploadAvatar : removeAvatar)(fd);
        if (result?.error) return void toast.error(result.error);
        toast.success(photo ? "Photo saved" : "Photo removed");
        setOpen(false);
        setCamera(false);
      } catch (error) {
        unstable_rethrow(error);
        toast.error("Couldn't save the photo. Try again.");
      }
    });
  }

  async function pickFile(file: File) {
    try {
      // iPhone photos (HEIC) only open natively in Safari; convert them here.
      const heic = /\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]/.test(file.type);
      const bitmap = heic
        ? await (await import("heic-to/next")).heicTo({ blob: file, type: "bitmap" })
        : await createImageBitmap(file);
      send(await toSquareJpeg(bitmap, bitmap.width, bitmap.height));
    } catch {
      toast.error("Couldn't open that image. Use a JPG, PNG, WebP or iPhone (HEIC) photo.");
    }
    if (input.current) input.current.value = "";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative shrink-0 rounded-full"
        aria-label={src ? `Change ${whose} photo` : `Add ${whose} photo`}
      >
        <Avatar name={name} src={src} size={size} />
        <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border-2 border-surface bg-foreground text-surface group-hover:scale-105">
          <Camera className="size-3.5" />
        </span>
      </button>

      <Modal open={open} onClose={() => (setOpen(false), setCamera(false))} title="Profile photo">
        {camera ? (
          <CameraCapture busy={pending} onCapture={send} onCancel={() => setCamera(false)} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar name={name} src={src} size="xl" className="size-40! text-5xl!" />
              {pending && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-surface/70">
                  <Loader2 className="size-6 animate-spin" />
                </span>
              )}
            </div>
            <p className="text-center text-sm text-muted">
              {memberId
                ? "Helps the front desk recognise them at check-in. Only the gym's team can see it."
                : "Shown to your gym's team, and to members so they know who you are."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" disabled={pending} onClick={() => setCamera(true)}>
                <Camera className="size-4" /> Take photo
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={() => input.current?.click()}>
                <ImagePlus className="size-4" /> Upload
              </Button>
              {src && (
                <Button type="button" variant="ghost" disabled={pending} onClick={() => send(null)} className="text-danger">
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="sr-only"
              tabIndex={-1}
              aria-label="Photo file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickFile(file);
              }}
            />
          </div>
        )}
      </Modal>
    </>
  );
}

// Live webcam preview (front camera on phones) and a shutter button.
function CameraCapture({ busy, onCapture, onCancel }: { busy: boolean; onCapture: (photo: Blob) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [cameraError, setError] = useState<string>();
  // Only rendered in the open dialog, so this runs in the browser.
  const error = navigator.mediaDevices ? cameraError : "This browser can't use the camera. Upload a photo instead.";

  useEffect(() => {
    if (!navigator.mediaDevices) return;
    let stream: MediaStream | undefined;
    let stopped = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } } })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("Couldn't open the camera. Allow camera access in the browser, or upload a photo instead."));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    onCapture(await toSquareJpeg(v, v.videoWidth, v.videoHeight));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {error ? (
        <p className="text-center text-sm text-danger">{error}</p>
      ) : (
        <video ref={video} autoPlay playsInline muted className="aspect-square w-64 rounded-full bg-black object-cover -scale-x-100" />
      )}
      <div className="flex gap-2">
        {!error && (
          <Button type="button" onClick={capture} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />} Capture
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Back
        </Button>
      </div>
    </div>
  );
}
