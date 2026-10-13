"use client";

import { useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { rolesLabel, ROLE_TITLES } from "@gymos/shared";
import type { GymRole } from "@/lib/auth";
import { updateMember } from "./actions";

const EXTRA: GymRole[] = ["admin", "staff", "trainer"];

// A person's main role plus anything else they do here ("Trainer + Staff").
// Opens a small panel; saves on Save, keeps the old roles if it fails.
export function RoleSelect({ slug, memberId, role, extraRoles, options, extraOptions, isOwner, name }: {
  slug: string;
  memberId: string;
  role: GymRole;
  extraRoles: GymRole[];
  // Main roles the current user may pick (admin only for the owner).
  options: GymRole[];
  // Extra roles the current user may tick.
  extraOptions: GymRole[];
  // The owner's own row: main role is fixed, extras can be added.
  isOwner?: boolean;
  name: string;
}) {
  const [saved, setSaved] = useState({ role, extra: extraRoles });
  const [draft, setDraft] = useState(saved);
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDetailsElement>(null);

  function save() {
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("id", memberId);
    formData.set("role", draft.role);
    for (const r of draft.extra.filter((r) => r !== draft.role)) formData.append("extra", r);
    startTransition(async () => {
      try {
        const result = await updateMember(formData);
        if (result?.error) {
          toast.error(result.error);
          setDraft(saved);
        } else {
          setSaved(draft);
          toast.success(`${name}: ${rolesLabel(draft.role, draft.extra)}`);
          panel.current?.removeAttribute("open");
        }
      } catch (error) {
        unstable_rethrow(error);
        setDraft(saved);
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  const extras = EXTRA.filter((r) => r !== draft.role && (extraOptions.includes(r) || draft.extra.includes(r)));
  return (
    <details ref={panel} className="relative inline-block" onToggle={(e) => !e.currentTarget.open && setDraft(saved)}>
      <summary
        aria-label={`Roles for ${name}: ${rolesLabel(saved.role, saved.extra)}. Change`}
        className="inline-flex cursor-pointer list-none items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-sm hover:bg-border/30"
      >
        {rolesLabel(saved.role, saved.extra)}
        {pending ? <Loader2 className="size-3.5 animate-spin text-muted" /> : <ChevronDown className="size-3.5 text-muted" />}
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-60 space-y-3 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Main role</span>
          <select
            aria-label="Main role"
            value={draft.role}
            disabled={isOwner || pending}
            onChange={(e) => setDraft((d) => ({ role: e.target.value as GymRole, extra: d.extra.filter((r) => r !== e.target.value) }))}
            className="w-full rounded border border-border bg-surface px-2 py-1 disabled:opacity-60"
          >
            {(isOwner ? (["owner"] as GymRole[]) : options).map((r) => <option key={r} value={r}>{ROLE_TITLES[r]}</option>)}
          </select>
        </label>
        {extras.length > 0 && (
          <fieldset className="space-y-1">
            <legend className="text-xs font-medium text-muted">Also works as</legend>
            {extras.map((r) => (
              <label key={r} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.extra.includes(r)}
                  disabled={pending || !extraOptions.includes(r)}
                  onChange={(e) => setDraft((d) => ({ ...d, extra: e.target.checked ? [...d.extra, r] : d.extra.filter((x) => x !== r) }))}
                />
                {ROLE_TITLES[r]}
              </label>
            ))}
          </fieldset>
        )}
        <button
          type="button"
          onClick={save}
          disabled={pending || (draft.role === saved.role && [...draft.extra].sort().join() === [...saved.extra].sort().join())}
          className="w-full rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-fg disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </details>
  );
}
