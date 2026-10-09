"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/components/tooltip";

// Native <dialog> modal: focus is trapped; the ✕ button or Escape closes it.
// Clicking the backdrop does not, so half-filled forms aren't lost by accident.
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-left text-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <Tooltip content="Close (Esc)" side="left" inline>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-border/40">
            <X className="size-5" />
          </button>
        </Tooltip>
      </div>
      <div className="p-5">{open && children}</div>
    </dialog>
  );
}
