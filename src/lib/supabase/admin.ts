import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Thrown when a required server-side env var is missing. Kept as a distinct
 * class so callers can tell "misconfigured deployment" apart from a genuine
 * Supabase API failure and report it accordingly.
 */
export class SupabaseAdminConfigError extends Error {
  constructor(missingVar: string) {
    super(
      `${missingVar} is not set in this environment. Add it in your deployment platform's ` +
        `environment variables (server-side only — never prefix it with NEXT_PUBLIC_) and redeploy.`
    );
    this.name = "SupabaseAdminConfigError";
  }
}

/**
 * TEMPORARY DIAGNOSTIC — logs whether the required env vars are present in
 * *this specific running function invocation*, plus which Vercel
 * environment/deployment served the request. NEVER logs the actual secret
 * value — only `true`/`false` and its character length.
 *
 * Also included: `VERCEL_ENV` ("production" | "preview" | "development")
 * and `VERCEL_URL`, both auto-injected by Vercel and non-sensitive. These
 * are the fastest way to confirm whether a request is actually landing on
 * the deployment/environment you think it is — a stale deployment (created
 * before an env var was added or changed) will NOT pick up the new value
 * until a fresh deployment runs, even though the dashboard shows it saved.
 */
export function logEnvPresence(context: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(
    `[env-check:${context}] ` +
      `NEXT_PUBLIC_SUPABASE_URL(present=${Boolean(url)},len=${url?.length ?? 0}) ` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY(present=${Boolean(anonKey)},len=${anonKey?.length ?? 0}) ` +
      `SUPABASE_SERVICE_ROLE_KEY(present=${Boolean(serviceRoleKey)},len=${serviceRoleKey?.length ?? 0}) ` +
      `VERCEL_ENV=${process.env.VERCEL_ENV ?? "n/a"} ` +
      `NODE_ENV=${process.env.NODE_ENV ?? "n/a"} ` +
      `VERCEL_URL=${process.env.VERCEL_URL ?? "n/a"} ` +
      `VERCEL_GIT_COMMIT_SHA=${process.env.VERCEL_GIT_COMMIT_SHA ?? "n/a"}`
  );
}

/**
 * Server-only Supabase client using the service role key. Never import this
 * file from a Client Component — it bypasses Row Level Security entirely.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new SupabaseAdminConfigError("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new SupabaseAdminConfigError("SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
