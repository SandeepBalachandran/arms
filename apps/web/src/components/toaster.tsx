"use client";

import { Toaster as HotToaster } from "react-hot-toast";

// App-wide toasts, styled with the theme tokens so they follow light/dark.
export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        duration: 3500,
        style: {
          background: "var(--surface)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          fontSize: "14px",
        },
        success: { iconTheme: { primary: "var(--brand)", secondary: "var(--brand-fg)" } },
        error: { duration: 6000, iconTheme: { primary: "var(--danger)", secondary: "#fff" } },
      }}
    />
  );
}
