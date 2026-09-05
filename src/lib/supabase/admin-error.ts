import { SupabaseAdminConfigError } from "./admin";

/**
 * TEMPORARY DIAGNOSTIC HELPER — classifies a failure from a service-role
 * Supabase call (e.g. auth.admin.listUsers/createUser) into:
 *  - `log`: a detailed line for `console.error`, visible in Vercel's
 *    Function Logs, safe to leave in place long-term.
 *  - `userMessage`: a message safe to return to the browser. It never
 *    contains the service role key itself (Supabase error messages don't
 *    echo the key value — only whether it was accepted).
 */
export function describeAdminError(err: unknown, context: string): { log: string; userMessage: string } {
  if (err instanceof SupabaseAdminConfigError) {
    return {
      log: `[${context}] Missing configuration: ${err.message}`,
      userMessage: `Server misconfiguration: ${err.message}`,
    };
  }

  const message = (err as { message?: string })?.message ?? String(err);
  const status = (err as { status?: number })?.status ?? (err as { code?: number })?.code;
  const looksLikeAuthRejection =
    status === 401 ||
    status === 403 ||
    /invalid api key|jwt|not authorized|permission denied/i.test(message);

  if (looksLikeAuthRejection) {
    return {
      log: `[${context}] Supabase rejected the service role key (status: ${status ?? "unknown"}): ${message}`,
      userMessage:
        "Supabase rejected the service role key. In your deployment's environment variables, verify " +
        "SUPABASE_SERVICE_ROLE_KEY is the service_role key (not the anon key) from the same Supabase " +
        "project as NEXT_PUBLIC_SUPABASE_URL, then redeploy.",
    };
  }

  return {
    log: `[${context}] ${message}`,
    userMessage: `Could not load users: ${message}`,
  };
}
