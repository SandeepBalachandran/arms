"use client";

import { Check, Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { GRID_ROLES, PERMISSIONS, ROLE_TITLES, type GridRole, type Permission, type PermissionInfo } from "@gymos/shared";
import { Button, Card, FormError } from "@/components/ui";
import { useSavedToast } from "@/lib/use-saved-toast";
import { saveGrid } from "./actions";

// editable: the signed-in person may change this cell (the database decides).
export type Cell = { allowed: boolean; isDefault: boolean; editable: boolean };

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];
const MEMBER_GROUP = "In the member app";

// The owner's grid: one row per permission, one column per role. The owner's
// own column is always ticked and can't be changed.
export function PermissionGrid({ slug, cells, sectionsOff }: {
  slug: string;
  cells: Record<string, Cell>;
  // Labels of gym sections that are switched off, by permission.
  sectionsOff: Partial<Record<Permission, string>>;
}) {
  const [state, action, pending] = useActionState(saveGrid, undefined);
  useSavedToast(state, "Permissions saved");
  const [phoneRole, setPhoneRole] = useState<GridRole>(GRID_ROLES[0]);
  const [ticked, setTicked] = useState(() => new Set(Object.entries(cells).filter(([, c]) => c.allowed).map(([id]) => id)));
  const initial = Object.entries(cells).filter(([, c]) => c.allowed).map(([id]) => id).sort().join();
  const dirty = [...ticked].sort().join() !== initial;

  const toggle = (id: string) =>
    setTicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Team permissions don't apply to members, and the in-app ones are what members do.
  const applies = (p: PermissionInfo, role: GridRole) => (role === "member" ? p.group === MEMBER_GROUP : true);

  const PLURAL: Record<GridRole, string> = { admin: "admins", staff: "front desk staff", trainer: "trainers", member: "members" };
  // Phones show one role at a time (the table is too wide for five columns).
  const phoneHide = (role: GridRole) => (role === phoneRole ? "" : "hidden md:table-cell");

  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="slug" value={slug} />
      {[...ticked].map((id) => <input key={id} type="hidden" name="cell" value={id} />)}
      <div role="tablist" aria-label="Role" className="no-scrollbar mb-3 flex gap-2 overflow-x-auto md:hidden">
        {GRID_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={r === phoneRole}
            onClick={() => setPhoneRole(r)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${r === phoneRole ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface"}`}
          >
            {ROLE_TITLES[r]}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted md:hidden">Ticked means allowed. The owner can always do everything.</p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm md:min-w-[640px]">
          <thead>
            <tr className="border-b border-border text-left">
              {/* Phones show one role, so name it; wider screens tick per column. */}
              <th className="p-3 font-medium">
                <span className="md:hidden">What {PLURAL[phoneRole]} can do</span>
                <span className="hidden md:inline">What each role can do</span>
              </th>
              <th className="hidden w-20 p-3 text-center font-medium md:table-cell">{ROLE_TITLES.owner}</th>
              {GRID_ROLES.map((r) => <th key={r} className={`w-20 p-3 text-center font-medium ${phoneHide(r)}`}>{ROLE_TITLES[r]}</th>)}
            </tr>
          </thead>
          {GROUPS.map((group) => (
            <tbody key={group}>
              <tr className="bg-background/60">
                <th colSpan={2 + GRID_ROLES.length} className="px-3 pt-4 pb-1 text-left text-xs font-semibold tracking-wide text-muted uppercase">{group}</th>
              </tr>
              {PERMISSIONS.filter((p) => p.group === group).map((p) => {
                const off = sectionsOff[p.key];
                return (
                  <tr key={p.key} className={`border-b border-border last:border-0 ${off ? "opacity-50" : ""}`}>
                    <td className="p-3">
                      <p className="font-medium">{p.label}</p>
                      <p className="text-xs text-muted">{off ? `${off} is turned off` : p.hint}</p>
                    </td>
                    <td className="hidden p-3 text-center md:table-cell" title="The owner can always do everything">
                      <span className="inline-flex size-6 items-center justify-center rounded-md bg-border/60 text-muted">
                        <Lock className="size-3.5" aria-label="Always allowed" />
                      </span>
                    </td>
                    {GRID_ROLES.map((role) => {
                      const id = `${role}:${p.key}`;
                      if (!applies(p, role) || !(id in cells)) return <td key={role} className={`p-3 text-center text-muted ${phoneHide(role)}`}>–</td>;
                      const on = ticked.has(id);
                      const changed = on !== cells[id].allowed || !cells[id].isDefault;
                      if (!cells[id].editable) {
                        return (
                          <td key={role} className={`p-3 text-center ${phoneHide(role)}`} title="Only the owner can change this">
                            <span className={`inline-flex size-6 items-center justify-center rounded-md border opacity-60 ${on ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface text-muted"}`}>
                              {on ? <Check className="size-4" aria-label={`${ROLE_TITLES[role]}: ${p.label} (allowed, locked)`} /> : <Lock className="size-3" aria-label={`${ROLE_TITLES[role]}: ${p.label} (not allowed, locked)`} />}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={role} className={`p-3 text-center ${phoneHide(role)}`}>
                          <label className="inline-flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={on}
                              onChange={() => toggle(id)}
                              aria-label={`${ROLE_TITLES[role]}: ${p.label}`}
                            />
                            <span
                              className={`inline-flex size-6 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${
                                on ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface"
                              } ${changed ? "ring-2 ring-amber-400/70" : ""}`}
                            >
                              {on && <Check className="size-4" />}
                            </span>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </Card>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button loading={pending} disabled={pending || !dirty}>{pending ? "Saving…" : "Save changes"}</Button>
        {dirty && <span className="text-sm text-muted">Unsaved changes</span>}
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted">
          <span className="inline-block size-3 rounded ring-2 ring-amber-400/70" /> Changed from the default
        </span>
      </div>
      <FormError message={state?.error} />
    </form>
  );
}
