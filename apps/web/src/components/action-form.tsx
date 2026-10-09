"use client";

import { useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import toast from "react-hot-toast";
import type { ActionResult } from "@/lib/action-result";

// A <form> for one-click server actions (Hide, Delete, Approve…). Shows a
// success toast, or the action's error message, instead of the error page.
// Optionally asks for confirmation first.
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

  return (
    <form
      className={className}
      aria-busy={pending}
      action={(formData) => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (result?.error) toast.error(result.error);
            else if (success) toast.success(success);
          } catch (error) {
            unstable_rethrow(error); // let redirects and not-found through
            toast.error("Something went wrong. Please try again.");
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
