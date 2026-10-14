"use client";

import { useEffect } from "react";

// Registers the service worker (public/sw.js) so GOS can be installed and shows
// an offline notice. Production only: the dev server's files change in place.
export function RegisterPwa() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
