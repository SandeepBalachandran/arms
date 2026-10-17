"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

// A plain <button> for server-component forms (<form action={serverAction}>),
// e.g. Sign out: shows the spinner (data-loading, globals.css) and blocks
// double clicks while the server works.
export function SubmitButton(props: ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return <button {...props} disabled={props.disabled || pending} data-loading={pending ? "" : undefined} />;
}
