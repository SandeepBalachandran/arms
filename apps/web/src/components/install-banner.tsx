"use client";

import { Download, EllipsisVertical, Share, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { androidAppUrl } from "@/lib/site";
import { BRAND } from "@gymos/shared";

// "Put <name> on your home screen", for people using the site in a browser (the sign-in
// page and the home page). One app for members and gym staff alike.
// - Chrome/Edge on Android: an Install button (the browser's own prompt).
// - iPhone/iPad Safari: how to do it from the Share menu (no prompt there).
// - Anything else (desktop): nothing. Hidden once installed, and for two weeks after closing it.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __gosInstallPrompt?: InstallPrompt;
  }
}

const DISMISS_KEY = "gos.installDismissedAt";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

const subscribe = () => () => {};

function useEnv() {
  // Browser-only facts. The server snapshot is "nothing to show".
  const key = useSyncExternalStore(
    subscribe,
    () => {
      const ua = navigator.userAgent;
      const installed =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      let dismissed = false;
      try {
        dismissed = Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < DISMISS_MS;
      } catch {}
      const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
      const android = /android/i.test(ua);
      return installed || dismissed ? "hidden" : ios ? "ios" : android ? "android" : "hidden";
    },
    () => "hidden",
  );
  return key as "hidden" | "ios" | "android";
}

export function InstallBanner() {
  const env = useEnv();
  const [closed, setClosed] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | undefined>();

  useEffect(() => {
    const ready = () => setPrompt(window.__gosInstallPrompt);
    ready();
    window.addEventListener("gos-installable", ready);
    window.addEventListener("appinstalled", () => setClosed(true));
    return () => window.removeEventListener("gos-installable", ready);
  }, []);

  if (env === "hidden" || closed) return null;
  const appUrl = androidAppUrl();

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setClosed(true);
  };

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-3 text-sm shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Put {BRAND.name} on your home screen</p>
          {env === "ios" ? (
            <p className="mt-0.5 text-muted">
              Tap <Share className="inline size-4 align-text-bottom" /> Share, then &ldquo;Add to Home Screen&rdquo;. One app for members and gym staff.
            </p>
          ) : prompt ? (
            <p className="mt-0.5 text-muted">Opens like an app, full screen. One app for members and gym staff.</p>
          ) : (
            // Chrome hasn't offered its install prompt (yet): its menu still can.
            <p className="mt-0.5 text-muted">
              Tap <EllipsisVertical className="inline size-4 align-text-bottom" /> in Chrome, then &ldquo;Add to Home screen&rdquo;. Opens like an app.
            </p>
          )}
          {env === "android" && (prompt || appUrl) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {prompt && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-fg"
                  onClick={async () => {
                    await prompt.prompt();
                    const { outcome } = await prompt.userChoice;
                    if (outcome === "accepted") setClosed(true);
                    window.__gosInstallPrompt = undefined;
                    setPrompt(undefined);
                  }}
                >
                  <Download className="size-4" /> Install
                </button>
              )}
              {appUrl && (
                <a href={appUrl} className="rounded-lg border border-border px-3 py-1.5 font-medium">
                  Get the Android app
                </a>
              )}
            </div>
          )}
        </div>
        <button type="button" aria-label="Not now" className="rounded p-1 text-muted hover:text-foreground" onClick={close}>
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
