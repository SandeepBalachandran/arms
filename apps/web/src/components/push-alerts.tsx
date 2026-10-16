"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, BellOff, Send } from "lucide-react";
import toast from "react-hot-toast";
import { deletePushSubscription, savePushSubscription, sendTestPushAlert } from "@/app/admin/push-actions";
import { menuItemClass } from "@/components/menu-styles";

// "Turn on payment alerts" for this device, in the admin's notification menu.
// The browser asks for permission, then the device gets a phone notification
// when a member says they paid by UPI (see lib/push.ts and public/sw.js).

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function registration() {
  // Production registers the worker on load (register-pwa.tsx); this covers dev too.
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export function PushAlerts() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!KEY || !("serviceWorker" in navigator)) return setState("unsupported");
      if (!("PushManager" in window)) {
        // iPhones get web push only from the app added to the Home Screen.
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        return setState(ios ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      const sub = await (await registration()).pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  function turnOn() {
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      try {
        const reg = await registration();
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) }));
        const result = await savePushSubscription(sub.toJSON(), navigator.userAgent);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        setState("on");
        toast.success("Payment alerts are on for this device");
      } catch {
        toast.error("This browser couldn't turn alerts on.");
      }
    });
  }

  function turnOff() {
    startTransition(async () => {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  function test() {
    startTransition(async () => {
      const result = await sendTestPushAlert();
      if (result?.error) toast.error(result.error);
    });
  }

  if (state === "loading" || state === "unsupported") return null;
  const note = "border-t border-border px-4 py-2 text-xs text-muted";
  if (state === "ios-install") return <p className={note}>For payment alerts on iPhone, add this app to your Home Screen first (Share → Add to Home Screen).</p>;
  if (state === "blocked") return <p className={note}>Alerts are blocked for this site. Allow notifications in your browser settings to get payment alerts.</p>;

  return (
    <div className="border-t border-border py-1">
      {state === "off" ? (
        <button type="button" role="menuitem" onClick={turnOn} disabled={pending} className={menuItemClass}>
          <BellRing className="size-4 text-brand" aria-hidden />
          <span>
            Turn on payment alerts
            <span className="block text-xs text-muted">Get a phone alert when a member pays by UPI</span>
          </span>
        </button>
      ) : (
        <>
          <button type="button" role="menuitem" onClick={test} disabled={pending} className={menuItemClass}>
            <Send className="size-4" aria-hidden />
            Send a test alert
          </button>
          <button type="button" role="menuitem" onClick={turnOff} disabled={pending} className={menuItemClass}>
            <BellOff className="size-4" aria-hidden />
            Turn off alerts on this device
          </button>
        </>
      )}
    </div>
  );
}
