"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { BellOff, BellRing, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { deletePushSubscription, savePushSubscription, sendTestPushAlert } from "@/app/admin/push-actions";
import { menuItemClass } from "@/components/menu-styles";

// Payment alerts for this device (a phone notification when a member says they
// paid by UPI; see lib/push.ts and public/sw.js). On by default: where the
// browser already allows notifications they switch on by themselves; otherwise
// the dashboard shows a one-tap card (browsers only ask after a tap). The bell
// menu has on/off and a test.

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const CARD_DISMISS_KEY = "gos.alertsCardDismissedAt";
const CARD_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const SYNCED_KEY = "gos.alertsSynced";
const noSubscribe = () => () => {};

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

async function subscribe() {
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) }));
  return savePushSubscription(sub.toJSON(), navigator.userAgent);
}

function usePushAlerts() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"on" | "off" | "test" | null>(null);

  useEffect(() => {
    (async () => {
      if (!KEY || !("serviceWorker" in navigator)) return setState("unsupported");
      if (!("PushManager" in window)) {
        // iPhones get web push only from the app added to the Home Screen.
        return setState(/iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      if (Notification.permission !== "granted") return setState("off");
      // Allowed already: make sure this device is on, for whoever is signed in
      // now (once per browser session).
      const has = await (await registration()).pushManager.getSubscription();
      let synced = false;
      try {
        synced = sessionStorage.getItem(SYNCED_KEY) === "1";
      } catch {}
      if (!has || !synced) {
        const result = await subscribe();
        if (result?.error) return setState("off");
        try {
          sessionStorage.setItem(SYNCED_KEY, "1");
        } catch {}
      }
      setState("on");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = () => {
    setBusy("on");
    startTransition(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      try {
        const result = await subscribe();
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
  };

  const turnOff = () => {
    setBusy("off");
    startTransition(async () => {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  };

  const test = () => {
    setBusy("test");
    startTransition(async () => {
      const result = await sendTestPushAlert();
      if (result?.error) toast.error(result.error);
    });
  };

  const spin = (which: typeof busy) => (pending && busy === which ? "" : undefined);
  return { state, pending, spin, turnOn, turnOff, test };
}

/** On/off and a test alert, at the bottom of the admin's notification menu. */
export function PushAlerts() {
  const { state, pending, spin, turnOn, turnOff, test } = usePushAlerts();

  if (state === "loading" || state === "unsupported") return null;
  const note = "border-t border-border px-4 py-2 text-xs text-muted";
  if (state === "ios-install") return <p className={note}>For payment alerts on iPhone, add this app to your Home Screen first (Share → Add to Home Screen).</p>;
  if (state === "blocked") return <p className={note}>Alerts are blocked for this site. Allow notifications in your browser settings to get payment alerts.</p>;

  return (
    <div className="border-t border-border py-1">
      {state === "off" ? (
        <button type="button" role="menuitem" onClick={turnOn} disabled={pending} data-loading={spin("on")} className={menuItemClass}>
          <BellRing className="size-4 text-brand" aria-hidden />
          <span>
            Turn on payment alerts
            <span className="block text-xs text-muted">Get a phone alert when a member pays by UPI</span>
          </span>
        </button>
      ) : (
        <>
          <button type="button" role="menuitem" onClick={test} disabled={pending} data-loading={spin("test")} className={menuItemClass}>
            <Send className="size-4" aria-hidden />
            Send a test alert
          </button>
          <button type="button" role="menuitem" onClick={turnOff} disabled={pending} data-loading={spin("off")} className={menuItemClass}>
            <BellOff className="size-4" aria-hidden />
            Turn off alerts on this device
          </button>
        </>
      )}
    </div>
  );
}

/** The dashboard's one-tap card while alerts are off on this device. "Not now" hides it for a week. */
export function PushAlertsCard() {
  const { state, pending, spin, turnOn } = usePushAlerts();
  // Dismissed in the last week? Read from this browser; the server render shows nothing.
  const dismissed = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return Date.now() - Number(localStorage.getItem(CARD_DISMISS_KEY) ?? 0) < CARD_DISMISS_MS;
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [closed, setClosed] = useState(false);
  const hidden = dismissed || closed;

  if (hidden || state !== "off") return null;
  const close = () => {
    try {
      localStorage.setItem(CARD_DISMISS_KEY, String(Date.now()));
    } catch {}
    setClosed(true);
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">
      <BellRing className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Get an alert when a member pays by UPI</p>
        <p className="mt-0.5 text-muted">Your phone buzzes the moment someone says they paid, so you can check and confirm.</p>
        <button
          type="button"
          onClick={turnOn}
          disabled={pending}
          data-loading={spin("on")}
          className="mt-2 rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-fg"
        >
          Turn on payment alerts
        </button>
      </div>
      <button type="button" onClick={close} aria-label="Not now" className="rounded p-1 text-muted hover:bg-border/40">
        <X className="size-4" />
      </button>
    </div>
  );
}
