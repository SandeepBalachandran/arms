"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <RadixTooltip.Provider delayDuration={300}>{children}</RadixTooltip.Provider>
);

// Accessible tooltip (Radix): shows on hover and keyboard focus. The trigger
// must be a single focusable element, e.g. a button or link. Use `inline`
// inside a <dialog>: a portal to <body> would sit under the dialog's top layer.
export function Tooltip({
  content,
  side = "top",
  inline = false,
  children,
}: {
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  inline?: boolean;
  children: ReactNode;
}) {
  const body = (
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-64 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md"
        >
          {content}
          <RadixTooltip.Arrow className="fill-foreground" />
        </RadixTooltip.Content>
  );
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      {inline ? body : <RadixTooltip.Portal>{body}</RadixTooltip.Portal>}
    </RadixTooltip.Root>
  );
}
