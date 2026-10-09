"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { registerGym } from "./actions";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function RegisterGymForm() {
  const [state, action, pending] = useActionState(registerGym, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Gym name">
        <Input
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label="Gym link" hint={`Members join at /join/${slug || "your-gym"}`}>
        <Input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
        />
      </Field>
      <input
        type="hidden"
        name="timezone"
        value={Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"}
      />
      <FormError message={state?.error} />
      <Button className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create gym"}
      </Button>
    </form>
  );
}
