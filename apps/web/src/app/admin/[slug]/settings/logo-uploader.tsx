"use client";

import { useRef, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import type { ActionResult } from "@/lib/action-result";
import { removeLogo, uploadLogo } from "./logo-actions";

// Square logo shown in the admin, on the join page and in the member app.
// Not a <form>: it sits inside the Gym profile form and saves on its own.
export function LogoUploader({ slug, gymName, logoUrl }: { slug: string; gymName: string; logoUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<ActionResult>, file: File | null, success: string) {
    const fd = new FormData();
    fd.set("slug", slug);
    if (file) fd.set("logo", file);
    startTransition(async () => {
      try {
        const result = await action(fd);
        if (result?.error) toast.error(result.error);
        else toast.success(success);
      } catch (error) {
        unstable_rethrow(error);
        toast.error("Couldn't save the logo. Try a smaller image.");
      }
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user upload on Supabase Storage
          <img src={logoUrl} alt={`${gymName} logo`} className="size-full object-cover" />
        ) : (
          <span className="text-2xl font-semibold text-muted">{gymName.slice(0, 1).toUpperCase()}</span>
        )}
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <Loader2 className="size-5 animate-spin" />
          </span>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Logo</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-border/40 disabled:opacity-50"
          >
            <ImagePlus className="size-4" /> {logoUrl ? "Change" : "Upload"}
          </button>
          {logoUrl && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(removeLogo, null, "Logo removed")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              <Trash2 className="size-4" /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">Square PNG, JPG or WebP, up to 2 MB. Saves straight away.</p>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) run(uploadLogo, file, "Logo updated");
          }}
        />
      </div>
    </div>
  );
}
