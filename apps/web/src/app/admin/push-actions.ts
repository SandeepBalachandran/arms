"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { sendToUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// A device turns phone alerts on or off (push-alerts.tsx). Rows belong to the
// signed-in person; RLS keeps them to their own.

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscription(input: unknown, userAgent: string): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { error: "This browser gave an alert address we can't use." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Sign in again." };

  const { endpoint, keys } = parsed.data;
  // The same device was signed in as someone else before: it's this person's now.
  // (Holding the endpoint proves it's this device, so the other row can go.)
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: data.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) return { error: error.message };
}

export async function deletePushSubscription(endpoint: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { error: error.message };
}

// "Send a test alert": proves this phone shows alerts before a real payment comes in.
export async function sendTestPushAlert(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Sign in again." };
  const sent = await sendToUsers([data.user.id], {
    title: "Alerts are on ✓",
    body: "You'll get an alert like this when a member pays by UPI.",
    url: "/go",
    tag: "test",
  });
  if (!sent) return { error: "Couldn't reach this device. Turn alerts off and on again." };
}
