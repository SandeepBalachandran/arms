"use client";

import { useActionState, useRef, useState } from "react";
import { Building2, CheckCircle2, Link2, Loader2, MessageCircle, XCircle } from "lucide-react";
import { AuthField, AuthInput } from "@/components/auth-shell";
import { Button, FormError } from "@/components/ui";
import { checkSlug, registerGym, type SlugCheck } from "./actions";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function RegisterGymForm({ siteUrl }: { siteUrl: string }) {
  const [state, action, pending] = useActionState(registerGym, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [check, setCheck] = useState<SlugCheck | "checking" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef("");

  // Checks the code shortly after typing stops; late answers for an older
  // value are ignored.
  function updateSlug(next: string) {
    setSlug(next);
    latest.current = next;
    clearTimeout(timer.current);
    if (next.length < 3) return setCheck(null);
    setCheck("checking");
    timer.current = setTimeout(async () => {
      try {
        const result = await checkSlug(next);
        if (latest.current === next) setCheck(result);
      } catch {
        if (latest.current === next) setCheck(null);
      }
    }, 450);
  }
  const taken = check !== null && check !== "checking" && check.status !== "available";
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <form action={action} className="space-y-4">
      <AuthField label="Gym name" icon={Building2}>
        <AuthInput
          name="name"
          placeholder="Iron Temple Fitness"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) updateSlug(slugify(e.target.value));
          }}
        />
      </AuthField>
      <AuthField label="Gym code" icon={Link2} hint="Lowercase letters, numbers and dashes. Members can also type this in the app.">
        <AuthInput
          name="slug"
          placeholder="iron-temple"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            updateSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
          }}
        />
      </AuthField>

      {check && (
        <div className="-mt-2 space-y-2 text-sm" aria-live="polite">
          {check === "checking" ? (
            <p className="flex items-center gap-1.5 text-muted"><Loader2 className="size-4 animate-spin" /> Checking…</p>
          ) : check.status === "available" ? (
            <p className="flex items-center gap-1.5 font-medium text-brand"><CheckCircle2 className="size-4" /> {slug} is available</p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 font-medium text-danger">
                <XCircle className="size-4" /> {check.status === "taken" ? `${slug} is taken by another gym` : check.message}
              </p>
              {check.suggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted">Try:</span>
                  {check.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSlugTouched(true);
                        updateSlug(s);
                      }}
                      className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs hover:border-brand hover:text-brand"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Preview of the invite as it will look when shared. */}
      <div className="rounded-xl border border-border bg-background p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Your invite link</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25d366]/15 text-[#128c7e]">
            <MessageCircle className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Join {name.trim() || "your gym"} on GOS</p>
            <p className="truncate font-mono text-xs text-muted">
              {host}/join/<span className="text-brand">{slug || "your-gym"}</span>
            </p>
          </div>
        </div>
      </div>

      <FormError message={state?.error} />
      <Button className="h-11 w-full rounded-xl text-base" disabled={pending || taken || check === "checking"}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Creating…" : "Create gym"}
      </Button>
    </form>
  );
}
