import "server-only";
import webpush from "web-push";
import type { Permission } from "@gymos/shared";
import { createAdminClient } from "@/lib/supabase/admin";

// Phone alerts for the gym team (web push). Devices turn alerts on from the
// admin's notification menu (push-alerts.tsx); public/sw.js shows them.

export type PushMessage = {
  title: string;
  body: string;
  /** Page to open when the alert is tapped. */
  url: string;
  /** Alerts with the same tag replace each other on the phone. */
  tag?: string;
};

export const pushConfigured = () =>
  !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

/**
 * Sends `message` to every device of the gym's team who has `permission`.
 * `key` makes it once-only: a second call with the same key sends nothing.
 * Returns how many devices it reached.
 */
export async function alertTeam(gymId: string, permission: Permission, key: string, message: PushMessage) {
  if (!pushConfigured()) return 0;
  const admin = createAdminClient();

  const { error: once } = await admin.from("push_sent").insert({ key });
  if (once) return 0; // already sent (primary key) or the table is missing

  const { data: holders } = await admin.rpc("permission_holders", { p_gym_id: gymId, p_permission: permission });
  if (!holders?.length) return 0;
  return sendToUsers(holders, message);
}

/** Sends `message` to every device of these people. Returns how many it reached. */
export async function sendToUsers(userIds: string[], message: PushMessage) {
  if (!pushConfigured() || !userIds.length) return 0;
  const admin = createAdminClient();
  const { data: devices } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!devices?.length) return 0;

  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const payload = JSON.stringify(message);
  const gone: string[] = [];
  const results = await Promise.allSettled(
    devices.map((d) =>
      webpush
        .sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "high" })
        .catch((e: { statusCode?: number }) => {
          // The device turned alerts off or the browser dropped it.
          if (e.statusCode === 404 || e.statusCode === 410) gone.push(d.id);
          throw e;
        }),
    ),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  return results.filter((r) => r.status === "fulfilled").length;
}
