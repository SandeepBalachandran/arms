"use client";

import { useActionState, useState } from "react";
import { Building2, Link2, Loader2, MessageCircle } from "lucide-react";
import { AuthField, AuthInput } from "@/components/auth-shell";
import { Button, FormError } from "@/components/ui";
import { registerGym } from "./actions";

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
            if (!slugTouched) setSlug(slugify(e.target.value));
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
            setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
          }}
        />
      </AuthField>

      {/* Preview of the invite as it will look when shared. */}
      <div className="rounded-xl border border-border bg-background p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Your invite link</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25d366]/15 text-[#128c7e]">
            <MessageCircle className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Join {name.trim() || "your gym"} on GymOS</p>
            <p className="truncate font-mono text-xs text-muted">
              {host}/join/<span className="text-brand">{slug || "your-gym"}</span>
            </p>
          </div>
        </div>
      </div>

      <FormError message={state?.error} />
      <Button className="h-11 w-full rounded-xl text-base" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Creating…" : "Create gym"}
      </Button>
    </form>
  );
}
