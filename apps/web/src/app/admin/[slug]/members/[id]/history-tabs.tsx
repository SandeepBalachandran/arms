"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";

// Tabs over panels rendered on the server.
export function HistoryTabs({ tabs }: { tabs: { id: string; label: string; count?: number; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => setActive(t.id)}
            className={clsx(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              t.id === current.id ? "border-brand text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-xs text-muted">{t.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current.content}</div>
    </div>
  );
}
