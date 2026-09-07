"use client";

import { useEffect } from "react";

/**
 * Registers the static-shell service worker (public/sw.js). Renders
 * nothing — this only needs to run once on mount. Registration is wrapped
 * in try/catch and feature-detected: it silently no-ops in any browser or
 * environment without SW support, and a failure here never affects the
 * rest of the app (Supabase auth/data calls don't go through this at all).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app works identically without an active service
      // worker, just without installability/offline-shell caching.
    });
  }, []);

  return null;
}
