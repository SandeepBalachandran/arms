import clsx from "clsx";
import { Apple, Droplets, TriangleAlert, X } from "lucide-react";
import {
  addDays,
  ACTIVITY_LABELS,
  ageFrom,
  calorieBalance,
  dayTotals,
  FOOD_TYPE_LABELS,
  formatDay,
  GOAL_LABELS,
  MEAL_LABELS,
  MEALS,
  onTarget,
  type Activity,
} from "@gymos/shared";
import { ActionForm } from "@/components/action-form";
import { Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { deleteNutritionComment } from "./nutrition-actions";
import { CommentForm, TargetForm } from "./nutrition-forms";

const DAYS = 7;

// Nutrition on the member page, for owners/admins and the member's PT trainer
// (food logs are health data; RLS returns nothing to anyone else).
export async function NutritionCard({ slug, memberId, myMemberId, today }: {
  slug: string;
  memberId: string;
  myMemberId: string;
  today: string;
}) {
  const supabase = await createClient();
  const from = addDays(today, -(DAYS - 1));
  const [profileRes, targetRes, logsRes, waterRes, commentsRes, weightRes] = await Promise.all([
    supabase.from("nutrition_profiles").select("*").eq("member_id", memberId).maybeSingle(),
    supabase.from("nutrition_targets").select("*").eq("member_id", memberId).maybeSingle(),
    supabase.from("food_logs").select("*").eq("member_id", memberId).gte("logged_on", from).order("created_at"),
    supabase.from("water_logs").select("logged_on, glasses").eq("member_id", memberId).gte("logged_on", from),
    supabase
      .from("nutrition_comments")
      .select("id, day, body, created_at, author_member_id, author:gym_members!nutrition_comments_author_member_id_fkey(profiles!inner(full_name))")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("body_metrics").select("weight_kg").eq("member_id", memberId).not("weight_kg", "is", null)
      .order("measured_on", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const r of [profileRes, targetRes, logsRes, waterRes, commentsRes, weightRes]) if (r.error) throw r.error;

  const profile = profileRes.data;
  const target = targetRes.data;
  const logs = logsRes.data ?? [];
  const age = ageFrom(profile?.birth_year);
  const weight = weightRes.data?.weight_kg ? Number(weightRes.data.weight_kg) : null;
  const body =
    profile?.height_cm && age && profile.sex && weight
      ? { weightKg: weight, heightCm: Number(profile.height_cm), age, sex: profile.sex as "male" | "female", activity: profile.activity as Activity }
      : null;

  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, -i));
  const byDay = new Map(days.map((d) => [d, logs.filter((l) => l.logged_on === d)]));
  const water = new Map((waterRes.data ?? []).map((w) => [w.logged_on, w.glasses]));
  const logged = days.filter((d) => byDay.get(d)!.length > 0);
  const hits = target ? logged.filter((d) => onTarget(dayTotals(byDay.get(d)!).kcal, target.kcal)).length : 0;
  const dayLabel = (d: string) => (d === today ? "Today" : d === addDays(today, -1) ? "Yesterday" : formatDay(d));

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Apple className="size-5 text-brand" />
          <h2 className="font-medium">Nutrition</h2>
          {target && <Badge tone="good">{GOAL_LABELS[target.goal]}</Badge>}
        </div>
        {target && logged.length > 0 && (
          <p className="text-sm text-muted">
            Logged {logged.length} of {DAYS} days · on target {hits} {hits === 1 ? "day" : "days"}
          </p>
        )}
      </div>

      {/* About the member */}
      {profile?.consent_at ? (
        <div className="space-y-2 text-sm">
          <p className="text-muted">
            {[
              profile.height_cm && `${Number(profile.height_cm)} cm`,
              weight && `${weight} kg`,
              age && `${age} yrs`,
              profile.sex && (profile.sex === "male" ? "Male" : "Female"),
              profile.food_pref && FOOD_TYPE_LABELS[profile.food_pref],
              ACTIVITY_LABELS[profile.activity as Activity],
            ].filter(Boolean).join(" · ")}
          </p>
          {profile.notes && (
            <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span><strong>Notes from the member:</strong> {profile.notes}. For medical conditions, follow their doctor&apos;s advice.</span>
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-lg bg-border/40 px-3 py-2 text-sm text-muted">
          The member hasn&apos;t set up nutrition in the app yet. They&apos;ll see it under the Food tab.
        </p>
      )}

      <TargetForm
        slug={slug}
        memberId={memberId}
        current={target ? { goal: target.goal, kcal: target.kcal, protein_g: target.protein_g } : null}
        body={body}
      />

      {/* Last 7 days */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-3 font-medium">Day</th>
              <th className="py-2 pr-3 font-medium">Calories</th>
              <th className="py-2 pr-3 font-medium">Protein</th>
              <th className="py-2 pr-3 font-medium">Water</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const items = byDay.get(d)!;
              const t = dayTotals(items);
              const balance = target ? calorieBalance(t.kcal, target.kcal) : null;
              const status = !items.length
                ? { text: "Not logged", cls: "text-muted" }
                : !target ? { text: `${items.length} items`, cls: "text-muted" }
                : onTarget(t.kcal, target.kcal) ? { text: "On target ✓", cls: "text-brand font-medium" }
                : balance!.over ? { text: balance!.label, cls: "text-amber-600 font-medium" }
                : { text: balance!.label, cls: "text-sky-600 font-medium" };
              return (
                <tr key={d} className="border-b border-border align-top last:border-0">
                  <td className="py-2 pr-3 font-medium">{dayLabel(d)}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {items.length ? <>{t.kcal}{target && <span className="text-muted"> / {target.kcal}</span>}</> : "—"}
                  </td>
                  <td className={clsx("py-2 pr-3 tabular-nums", target && items.length && t.protein_g < target.protein_g * 0.8 && "text-amber-600")}>
                    {items.length ? <>{Math.round(t.protein_g)} g{target && <span className="text-muted"> / {target.protein_g}</span>}</> : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {water.get(d) ? <span className="inline-flex items-center gap-1"><Droplets className="size-3.5 text-sky-500" />{water.get(d)}</span> : "—"}
                  </td>
                  <td className="py-2">
                    <span className={status.cls}>{status.text}</span>
                    {items.length > 0 && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-muted hover:text-foreground">What they ate</summary>
                        <ul className="mt-1 space-y-0.5">
                          {MEALS.filter((m) => items.some((l) => l.meal === m)).map((m) => (
                            <li key={m}>
                              <span className="text-muted">{MEAL_LABELS[m]}:</span>{" "}
                              {items.filter((l) => l.meal === m).map((l) => `${l.name}${Number(l.servings) !== 1 ? ` ×${Number(l.servings)}` : ""} (${l.kcal})`).join(", ")}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Coach comments, shown to the member in the app */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Comments to the member</h3>
        <CommentForm slug={slug} memberId={memberId} days={days.slice(0, 3).map((d) => ({ value: d, label: dayLabel(d) }))} />
        {(commentsRes.data ?? []).map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg bg-border/30 px-3 py-2 text-sm">
            <div>
              <p>{c.body}</p>
              <p className="text-xs text-muted">{c.author?.profiles.full_name ?? "Coach"} · about {dayLabel(c.day)}</p>
            </div>
            {c.author_member_id === myMemberId && (
              <ActionForm action={deleteNutritionComment} confirm="Delete this comment?">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="member_id" value={memberId} />
                <button aria-label="Delete comment" className="rounded p-1 text-muted hover:bg-border/60">
                  <X className="size-4" />
                </button>
              </ActionForm>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Calories are estimates from the food list. Not medical advice.</p>
    </Card>
  );
}
