"use client";

import { useState, type ComponentProps } from "react";
import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui";

// Password field with an eye button to show or hide what's typed.
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={clsx("pr-10", className)} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-1 my-auto flex size-8 items-center justify-center rounded-md text-muted hover:text-foreground"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
