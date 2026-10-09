import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

// Small set of shared primitives. Keep them unstyled beyond the tokens in
// globals.css so the admin panel and member app share one look.

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" && "bg-brand text-brand-fg hover:opacity-90",
        variant === "secondary" && "border border-border bg-surface hover:bg-border/40",
        variant === "ghost" && "hover:bg-border/40",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={clsx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={clsx(
        "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand",
        className,
      )}
      {...props}
    />
  );
}

// `inline` puts the label to the left of the input instead of above it.
export function Field({ label, hint, inline, children }: {
  label: string;
  hint?: string;
  inline?: boolean;
  children: ReactNode;
}) {
  if (inline) {
    return (
      <label className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{label}</span>
        {children}
        {hint && <span className="col-start-2 text-xs text-muted">{hint}</span>}
      </label>
    );
  }
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={clsx("rounded-xl border border-border bg-surface p-4", className)}
      {...props}
    />
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {actions}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad"; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-border/60 text-foreground",
        tone === "good" && "bg-green-500/15 text-green-700 dark:text-green-400",
        tone === "warn" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        tone === "bad" && "bg-red-500/15 text-red-700 dark:text-red-400",
      )}
    >
      {children}
    </span>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-danger" role="alert">{message}</p>;
}
