"use client";

import { PlayCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { HOW_TO_MAX, videoLink } from "@gymos/shared";
import { Button, Field, FormError, Input } from "@/components/ui";
import { useSavedToast } from "@/lib/use-saved-toast";
import { saveGuide } from "./actions";

const textarea =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand min-h-28";

export function GuideForm({ slug, exerciseId, initial }: {
  slug: string;
  exerciseId: string;
  initial: { video_url: string | null; how_to_en: string | null; how_to_ml: string | null } | null;
}) {
  const [state, action, pending] = useActionState(saveGuide, undefined);
  useSavedToast(state, "Guide saved");
  const [video, setVideo] = useState(initial?.video_url ?? "");
  const [en, setEn] = useState(initial?.how_to_en ?? "");
  const [ml, setMl] = useState(initial?.how_to_ml ?? "");
  const link = videoLink(video);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="exercise_id" value={exerciseId} />

      <Field label="Video link" hint="YouTube, Instagram reel or Google Drive. Members open it in their phone's app.">
        <Input name="video_url" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtu.be/…" inputMode="url" />
      </Field>
      {video.trim() && (
        link ? (
          <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-2 hover:bg-border/30">
            {link.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
              <img src={link.thumbnail} alt="" className="h-16 w-28 rounded-lg object-cover" />
            ) : (
              <span className="flex h-16 w-28 items-center justify-center rounded-lg bg-background"><PlayCircle className="size-6 text-muted" /></span>
            )}
            <span className="text-sm">
              <span className="block font-medium">{link.label} video</span>
              <span className="text-muted">Opens in a new tab to check it</span>
            </span>
          </a>
        ) : (
          <p className="text-sm text-danger">That doesn&apos;t look like a full https:// link.</p>
        )
      )}

      <Field label="How to do it (English)" hint={`${en.length} / ${HOW_TO_MAX}`}>
        <textarea
          name="how_to_en"
          value={en}
          onChange={(e) => setEn(e.target.value)}
          maxLength={HOW_TO_MAX}
          className={textarea}
          placeholder={"1. Set the seat so the handles are at chest height.\n2. Push forward without locking your elbows.\n3. Come back slowly."}
        />
      </Field>
      <Field label="എങ്ങനെ ചെയ്യാം (Malayalam)" hint={`${ml.length} / ${HOW_TO_MAX} · Members who choose Malayalam see this; others see English.`}>
        <textarea
          name="how_to_ml"
          value={ml}
          onChange={(e) => setMl(e.target.value)}
          maxLength={HOW_TO_MAX}
          lang="ml"
          className={textarea}
          placeholder={"1. ഹാൻഡിലുകൾ നെഞ്ചിന്റെ ഉയരത്തിൽ വരുന്ന രീതിയിൽ സീറ്റ് ക്രമീകരിക്കുക.\n2. കൈമുട്ട് പൂർണ്ണമായി നിവർത്താതെ മുന്നോട്ട് തള്ളുക."}
        />
      </Field>
      <FormError message={state?.error} />
      <Button loading={pending}>{pending ? "Saving…" : "Save guide"}</Button>
    </form>
  );
}
