"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { GymRole } from "@/lib/auth";
import { updateMember } from "./actions";

// Saves as soon as a new role is picked; goes back to the old one if it fails.
export function RoleSelect({ slug, memberId, role, options, name }: {
  slug: string;
  memberId: string;
  role: GymRole;
  options: GymRole[];
  name: string;
}) {
  const [value, setValue] = useState(role);
  const [pending, startTransition] = useTransition();

  function change(next: GymRole) {
    const previous = value;
    setValue(next);
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("id", memberId);
    formData.set("role", next);
    startTransition(async () => {
      try {
        const result = await updateMember(formData);
        if (result?.error) {
          setValue(previous);
          toast.error(result.error);
        } else {
          toast.success(`${name} is now ${next === "admin" ? "an" : "a"} ${next}`);
        }
      } catch (error) {
        unstable_rethrow(error);
        setValue(previous);
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        aria-label={`Role for ${name}`}
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as GymRole)}
        className="rounded border border-border bg-surface px-2 py-1 capitalize disabled:opacity-60"
      >
        {options.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {pending && <Loader2 aria-label="Saving" className="size-4 animate-spin text-muted" />}
    </span>
  );
}
