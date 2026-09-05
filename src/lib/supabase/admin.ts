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
