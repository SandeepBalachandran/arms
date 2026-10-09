"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGym, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  slug: z.string(),
  id: z.uuid(),
  role: z.enum(["admin", "staff", "trainer", "member"]),
});

// RLS enforces the same rules (no owner edits, only owners grant admin);
// the checks here give a clear error instead of a silent no-op.
export async function updateMember(formData: FormData) {
  const { slug, id, role } = schema.parse(Object.fromEntries(formData));
  const { gym, role: myRole } = await requireGym(slug, STAFF_ROLES);
  if (role === "admin" && myRole !== "owner") throw new Error("Only the owner can make admins");

  const supabase = await createClient();
  const { error } = await supabase
    .from("gym_members")
    .update({ role })
    .eq("id", id)
    .eq("gym_id", gym.id)
    .neq("role", "owner");
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${slug}/members`);
}
