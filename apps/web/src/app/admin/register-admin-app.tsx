"use client";

import { useEffect } from "react";

// Lets the browser offer "Install GOS Admin" and shows a notice when offline.
export function RegisterAdminApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/gos-admin-sw.js", { scope: "/admin" }).catch(() => {});
  }, []);
  return null;
}
