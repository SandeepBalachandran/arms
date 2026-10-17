"use client";

import { useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import toast from "react-hot-toast";
import type { ActionResult } from "@/lib/action-result";

// A <form> for one-click server actions (Hide, Delete, Approve…). Shows a
// success toast, or the action's error message, instead of the error page.
// Optionally asks for confirmation first. While the server works, the button
// that was clicked shows a spinner (data-loading, globals.css) and the form is
// disabled, so it never looks frozen.
export function ActionForm({
  action,
  success,
  confirm,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  success?: string;
  confirm?: string;
  className?: string;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const clicked = useRef<HTMLElement | null>(null);

  return (
    <form
      className={className}
      aria-busy={pending}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        clicked.current = (e.nativeEvent as SubmitEvent).submitter ?? e.currentTarget.querySelector("button");
      }}
      action={(formData) => {
        if (confirm && !window.confirm(confirm)) return;
        const button = clicked.current;
        button?.setAttribute("data-loading", "");
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (result?.error) toast.error(result.error);
            else if (success) toast.success(success);
          } catch (error) {
            unstable_rethrow(error); // let redirects and not-found through
            toast.error("Something went wrong. Please try again.");
          } finally {
            button?.removeAttribute("data-loading");
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
