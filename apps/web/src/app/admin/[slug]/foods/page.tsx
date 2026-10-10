import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FOOD_TYPE_LABELS, type Food } from "@gymos/shared";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Input, PageHeader } from "@/components/ui";
import { requireGym, TEAM_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setFoodActive } from "./actions";
import { AddFood } from "./add-food";

export const metadata: Metadata = { title: "Foods" };

// The food list members pick from in the app: the gym's own foods plus the
// built-in Indian and Kerala list.
export default async function FoodsPage({ params, searchParams }: PageProps<"/admin/[slug]/foods">) {
  const { slug } = await params;
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().replace(/[%,()]/g, "") : "";
  const { gym } = await requireGym(slug, TEAM_ROLES);
  if (!gym.nutrition_enabled) notFound();

  const supabase = await createClient();
  let builtIn = supabase.from("foods").select("*").is("gym_id", null).order("category").order("name");
  if (query) builtIn = builtIn.or(`name.ilike.%${query}%,name_ml.ilike.%${query}%`);
  const [ownRes, builtInRes] = await Promise.all([
    supabase.from("foods").select("*").eq("gym_id", gym.id).order("is_active", { ascending: false }).order("name"),
    builtIn,
  ]);
  if (ownRes.error) throw ownRes.error;
  if (builtInRes.error) throw builtInRes.error;

  return (
    <>
      <PageHeader title="Foods" actions={<AddFood slug={slug} />} />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-muted">
        Members pick from these when they log a meal. Add dishes your members eat that aren&apos;t in the built-in list, such as
        your juice bar or a local canteen meal.
      </p>

      <h2 className="mb-2 font-medium">Your foods ({ownRes.data.length})</h2>
      <Card className="mb-8 overflow-x-auto p-0">
        {ownRes.data.length ? (
          <FoodTable foods={ownRes.data} slug={slug} editable />
        ) : (
          <p className="p-4 text-sm text-muted">None yet. The built-in list below covers most home food.</p>
        )}
      </Card>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Built-in Indian &amp; Kerala foods ({builtInRes.data.length})</h2>
        <form className="w-64">
          <Input name="q" defaultValue={query} placeholder="Search, e.g. puttu" />
        </form>
      </div>
      <Card className="overflow-x-auto p-0">
        <FoodTable foods={builtInRes.data} slug={slug} />
      </Card>
      <p className="mt-2 text-xs text-muted">Values are approximate home portions.</p>
    </>
  );
}

function FoodTable({ foods, slug, editable }: { foods: Food[]; slug: string; editable?: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted">
          <th className="p-3 font-medium">Food</th>
          <th className="p-3 font-medium">Portion</th>
          <th className="p-3 font-medium">kcal</th>
          <th className="p-3 font-medium">Protein</th>
          <th className="hidden p-3 font-medium md:table-cell">Carbs / fat</th>
          <th className="hidden p-3 font-medium sm:table-cell">Type</th>
          {editable && <th className="p-3"><span className="sr-only">Actions</span></th>}
        </tr>
      </thead>
      <tbody>
        {foods.map((f) => (
          <tr key={f.id} className={`border-b border-border last:border-0 ${f.is_active ? "" : "opacity-50"}`}>
            <td className="p-3">
              <p className="font-medium">{f.name}</p>
              {f.name_ml && <p className="text-xs text-muted">{f.name_ml}</p>}
            </td>
            <td className="p-3 text-muted">{f.serving_label}</td>
            <td className="p-3 tabular-nums">{f.kcal}</td>
            <td className="p-3 tabular-nums">{Number(f.protein_g)} g</td>
            <td className="hidden p-3 tabular-nums text-muted md:table-cell">{Number(f.carbs_g)} / {Number(f.fat_g)} g</td>
            <td className="hidden p-3 sm:table-cell"><Badge>{FOOD_TYPE_LABELS[f.food_type]}</Badge></td>
            {editable && (
              <td className="p-3 text-right">
                <ActionForm action={setFoodActive} success={f.is_active ? "Hidden from members" : "Shown to members"}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="active" value={String(!f.is_active)} />
                  <button className="rounded px-2 py-1 text-xs text-muted hover:bg-border/40">{f.is_active ? "Hide" : "Show"}</button>
                </ActionForm>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
