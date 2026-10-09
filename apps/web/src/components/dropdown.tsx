"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

// Small popover menu: opens from a trigger button, closes on outside click,
// Escape, or choosing a link. Items are plain links/buttons passed as children.
export function Dropdown({
  trigger,
  label,
  children,
  className,
}: {
  trigger: ReactNode;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          // Close when a link is chosen. Buttons keep it open: closing would
          // unmount a form (e.g. Sign out) before the browser submits it.
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          className={clsx(
            "absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-lg",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export const menuItemClass =
  "flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-border/40 focus-visible:bg-border/40 outline-none";
