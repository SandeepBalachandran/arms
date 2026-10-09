"use client";

import { useState } from "react";
import clsx from "clsx";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}

// One-button switch (landing page). The choice is kept in a cookie so the
// server renders the right theme on the next visit (no flash).
export function ThemeToggle({ initial, className }: { initial: Theme; className?: string }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={`Switch to ${next} theme`}
      className={className ?? "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-border/40"}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {theme === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}

// Light | Dark choice for menus.
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <span>Appearance</span>
      <div className="grid grid-cols-2 rounded-lg border border-border p-0.5">
        {(["light", "dark"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="menuitemradio"
            aria-checked={theme === t}
            onClick={() => {
              applyTheme(t);
              setTheme(t);
            }}
            className={clsx(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-brand",
              theme === t ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground",
            )}
          >
            {t === "light" ? <Sun className="size-3" /> : <Moon className="size-3" />}
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
