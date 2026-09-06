"use client";

import { useEffect, useReducer } from "react";

/**
 * Tiny in-memory cache for Admin Dashboard data, keyed by string.
 *
 * Lives at module scope, so it survives Next.js client-side navigation
 * between /admin, /admin/schools, /admin/users, /admin/reports — the
 * browser never reloads the page for a Link click, so this object stays
 * alive in memory. That's what makes returning to an already-visited tab
 * instant: the second mount finds `entry.data` already populated and skips
 * the network round trip entirely.
 *
 * Otherwise cleared only by a hard page reload — exactly the "don't
 * refetch on tab switch, only on manual Refresh" behavior the dashboard
 * needs. There is no time-based expiry on purpose: staleness is only ever
 * resolved by the user pressing Refresh.
 *
 * The one other time this MUST be cleared: signing out and a different
 * account signing in, in the same browser tab. Nothing here is keyed by
 * user id — keys like "myProfile" and "myReports" mean "whoever is
 * currently signed in" — so without an explicit clear, a second account
 * signing in in that tab would keep seeing the first account's cached
 * profile, school, and reports. clearAllCache() (called from the sign-out
 * button and right after a successful sign-in) is what prevents that.
 */
interface CacheEntry<T> {
  data: T | null;
  error: string | null;
  promise: Promise<void> | null;
  updatedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getEntry<T>(key: string): CacheEntry<T> {
  let entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    entry = { data: null, error: null, promise: null, updatedAt: 0 };
    cache.set(key, entry as CacheEntry<unknown>);
  }
  return entry;
}

/**
 * Wipes every cached entry — every tab's data for every user-scoped and
 * admin-scoped key. Call this on sign-out and right after a successful
 * sign-in, so no account ever sees a previous account's cached profile,
 * school, reports, or lists from the same browser tab.
 */
export function clearAllCache() {
  cache.clear();
}

function runFetch<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  const entry = getEntry<T>(key);
  const promise = fetcher()
    .then((data) => {
      entry.data = data;
      entry.error = null;
    })
    .catch((err) => {
      entry.error = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    })
    .finally(() => {
      entry.promise = null;
      entry.updatedAt = Date.now();
    });
  entry.promise = promise;
  return promise;
}

/**
 * Warms the cache in the background without any component depending on the
 * result — used right after landing on Overview to preload Schools/Users
 * data so those tabs are already instant the first time they're opened.
 * A no-op if the key is already cached or a fetch for it is in flight, so
 * calling it repeatedly (e.g. from more than one tab) never causes a
 * duplicate request.
 */
export function prefetchAdminData<T>(key: string, fetcher: () => Promise<T>) {
  const entry = getEntry<T>(key);
  if (entry.data !== null || entry.promise) return;
  runFetch(key, fetcher);
}

/**
 * React hook: cache-first data fetching for one Admin Dashboard section.
 * Returns cached data synchronously on every subsequent mount (no loading
 * flicker, no network call) until `refresh()` is called explicitly.
 */
export function useAdminCache<T>(key: string, fetcher: () => Promise<T>) {
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const entry = getEntry<T>(key);

  useEffect(() => {
    let cancelled = false;
    if (entry.data !== null) return;

    const promise = entry.promise ?? runFetch(key, fetcher);
    promise.then(() => {
      if (!cancelled) forceRender();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function refresh() {
    const target = getEntry<T>(key);
    target.data = null;
    target.error = null;
    return runFetch(key, fetcher).then(() => forceRender());
  }

  /**
   * Writes a local mutation (add/update/delete) straight into the cache
   * without a network round trip, so every other mounted or later-mounted
   * tab sharing this key (e.g. Schools and Users both read "schools")
   * immediately sees the change instead of stale data until a manual
   * Refresh.
   */
  function mutate(updater: (current: T | null) => T) {
    const target = getEntry<T>(key);
    target.data = updater(target.data);
    target.error = null;
    forceRender();
  }

  return {
    data: entry.data,
    error: entry.error,
    // Not "promise !== null" — on a component's very first render, the
    // fetch is kicked off by the effect above, which only runs *after*
    // that render commits. Checking the promise field here would read
    // false for that one render (no promise exists yet, even though a
    // fetch is about to start), letting a consumer briefly render its
    // empty/no-data UI before the real request even begins. Absence of
    // both data and error is the correct signal that a result is pending.
    loading: entry.data === null && entry.error === null,
    refresh,
    mutate,
  };
}
