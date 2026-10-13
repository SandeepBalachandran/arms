import type { Metadata } from "next";
import { PERMISSIONS, type Permission } from "@gymos/shared";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { requireGym } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resetGrid } from "./actions";
import { PermissionGrid, type Cell } from "./grid";

export const metadata: Metadata = { title: "Roles & permissions" };

const SECTION_LABELS = {
  checkin_enabled: "Check-in",
  classes_enabled: "Classes",
  workouts_enabled: "Workouts",
  nutrition_enabled: "Nutrition",
  pt_enabled: "Personal training",
} as const;

// Owner only: what admins, front desk, trainers and members may do here.
// People get roles on the Members page; one person can hold several.
export default async function RolesPage({ params }: PageProps<"/admin/[slug]/roles">) {
  const { slug } = await params;
  const { gym } = await requireGym(slug, ["owner"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("permission_grid", { p_gym_id: gym.id });
  if (error) throw error;

  const cells: Record<string, Cell> = Object.fromEntries(data.map((c) => [`${c.role}:${c.permission}`, { allowed: c.allowed, isDefault: c.is_default }]));
  const changed = data.filter((c) => !c.is_default).length;
  const sectionsOff: Partial<Record<Permission, string>> = Object.fromEntries(
    PERMISSIONS.filter((p) => p.section && !gym[p.section]).map((p) => [p.key, SECTION_LABELS[p.section!]]),
  );

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        actions={
          changed > 0 && (
            <ActionForm action={resetGrid} success="Back to the defaults" confirm="Reset every role to the default permissions?">
              <input type="hidden" name="slug" value={slug} />
              <button className="text-sm text-muted hover:text-foreground">Reset to defaults</button>
            </ActionForm>
          )
        }
      />
      <div className="-mt-4 mb-6 max-w-3xl space-y-2 text-sm text-muted">
        <p>
          Choose what each role can do at {gym.name}. As the owner you can always do everything. Turning sections on or off and
          changing gym settings are yours unless you tick them for someone here.
        </p>
        <p>
          Give people roles on the Members page. Someone can have more than one, for example a trainer who also works the front
          desk gets both columns&apos; permissions.
        </p>
      </div>
      <PermissionGrid slug={slug} cells={cells} sectionsOff={sectionsOff} />
    </>
  );
}
