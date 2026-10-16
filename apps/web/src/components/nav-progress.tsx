"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// "A page is loading" for the whole site: set when a link to another page of
// this site is clicked, cleared when the address changes. Shown as a thin
// lime bar along the top (NavProgress) and, in the admin, an outline of a page
// in place of the old one (PageContent). Done in the browser rather than with
// Next.js loading.tsx files, which would turn "not found" (404) pages into 200s.

let pendingFrom: string | null = null; // the address the click happened on
const listeners = new Set<() => void>();
function setPendingFrom(value: string | null) {
  if (pendingFrom === value) return;
  pendingFrom = value;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function useUrl() {
  return `${usePathname()}?${useSearchParams()}`;
}

// True from the click until the new page is on screen.
export function usePageLoading() {
  const url = useUrl();
  const from = useSyncExternalStore(subscribe, () => pendingFrom, () => null);
  return from === url;
}

export function NavProgress() {
  const url = useUrl();
  const loading = usePageLoading();

  // Arrived somewhere: forget the click, so going Back to that page later doesn't show the bar.
  useEffect(() => setPendingFrom(null), [url]);

  useEffect(() => {
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || to.pathname.startsWith("/app")) return;
      if (to.pathname === location.pathname && to.search === location.search) return; // same page (or a #hash)
      setPendingFrom(`${location.pathname}?${location.search.slice(1)}`);
      clearTimeout(giveUp);
      giveUp = setTimeout(() => setPendingFrom(null), 20_000);
    };
    // Capture phase: Next.js links cancel the click (they navigate themselves).
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(giveUp);
    };
  }, []);

  if (!loading) return null;
  return (
    <div role="progressbar" aria-label="Loading page" className="nav-progress-track pointer-events-none fixed inset-x-0 top-0 z-100 h-1 bg-brand/20">
      <div className="nav-progress h-full origin-left rounded-r-full bg-brand shadow-[0_0_10px] shadow-brand/70" />
    </div>
  );
}

// The admin's content area: while the next page loads, an outline of a page
// (title, cards, list) instead of the old one, which stays mounted underneath.
export function PageContent({ children }: { children: ReactNode }) {
  const loading = usePageLoading();
  return (
    <>
      {loading && <PageSkeleton />}
      <div className={loading ? "hidden" : "contents"}>{children}</div>
    </>
  );
}

function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="nav-skeleton space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-border" />
        <div className="h-4 w-64 max-w-full rounded bg-border/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="size-9 shrink-0 rounded-full bg-border" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/5 rounded bg-border" />
              <div className="h-3 w-1/4 rounded bg-border/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
