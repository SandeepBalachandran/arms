import clsx from "clsx";
import { initials } from "@gymos/shared";

const SIZES = {
  xs: "size-7 text-[11px]",
  sm: "size-9 text-sm",
  md: "size-11 text-base",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

// A person's photo (a signed URL from lib/avatars), or their initials.
export function Avatar({
  name,
  src,
  size = "sm",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const box = clsx("shrink-0 rounded-full", SIZES[size], className);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- signed URL from private Storage
    return <img src={src} alt="" className={clsx(box, "bg-border/40 object-cover")} />;
  }
  return (
    <span aria-hidden className={clsx(box, "flex items-center justify-center bg-brand font-semibold text-brand-fg")}>
      {initials(name)}
    </span>
  );
}
