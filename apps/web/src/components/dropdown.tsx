"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import clsx from "clsx";

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';

// Popover menu with keyboard support: opens on click, focuses the first item,
// ↑/↓/Home/End move between items, Escape closes and returns focus to the
// trigger. Closes on outside click or when a link is chosen.
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown" ? items[(i + 1) % items.length]
      : e.key === "ArrowUp" ? items[(i - 1 + items.length) % items.length]
      : e.key === "Home" ? items[0]
      : e.key === "End" ? items[items.length - 1]
      : null;
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  return (
    <div ref={ref} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={triggerRef}
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
          ref={menuRef}
          role="menu"
          aria-label={label}
          // Close when a link is chosen. Buttons keep it open: closing would
          // unmount a form (e.g. Sign out) before the browser submits it.
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          className={clsx(
            "absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg",
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
  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm outline-none hover:bg-border/40 focus-visible:bg-border/40";

export function MenuSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="border-t border-border py-1 first:border-t-0">
      {title && <p className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>}
      {children}
    </div>
  );
}
