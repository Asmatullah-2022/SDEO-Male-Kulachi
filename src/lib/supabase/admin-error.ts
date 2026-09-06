import { SupabaseAdminConfigError, SupabaseAdminKeyMismatchError } from "./admin";

/**
 * Logs a detailed, secret-free breakdown of a failed Supabase call:
 * error name, code, HTTP status, message, and stack trace (Supabase error
 * objects never carry the API key itself in these fields — they describe
 * the rejected request/response, not our credentials). Call this at the
 * exact point an operation fails, not just in an outer catch, so Vercel's
 * Function Logs show which specific Supabase call broke.
 */
export function logSupabaseError(context: string, err: unknown) {
  const e = err as { name?: string; message?: string; status?: number; code?: string; stack?: string };
  console.error(
    `[${context}] Supabase operation failed — ` +
      `name=${e?.name ?? "Unknown"} ` +
      `code=${e?.code ?? "n/a"} ` +
      `status=${e?.status ?? "n/a"} ` +
      `message=${e?.message ?? String(err)}`
  );
  if (e?.stack) {
    console.error(`[${context}] stack trace:\n${e.stack}`);
  }
}

/**
 * Classifies a caught error into:
 *  - `log`: a detailed line for `console.error`, visible in Vercel's
 *    Function Logs, safe to leave in place long-term.
 *  - `userMessage`: a message safe to return to the browser. It never
 *    contains the service role key itself — only whether it was accepted,
 *    what Supabase's own error said, and (when detectable from the key's
 *    own non-secret claims) precisely which misconfiguration it is.
 */
export function describeAdminError(err: unknown, context: string): { log: string; userMessage: string } {
  if (err instanceof SupabaseAdminConfigError) {
    return {
      log: `[${context}] Missing configuration: ${err.message}`,
      userMessage: `Server misconfiguration: ${err.message}`,
    };
  }

  if (err instanceof SupabaseAdminKeyMismatchError) {
    return {
      log: `[${context}] Key mismatch: ${err.message}`,
      userMessage: `Server misconfiguration: ${err.message}`,
    };
  }

  const e = err as { name?: string; message?: string; status?: number; code?: string };
  const message = e?.message ?? String(err);
  const status = e?.status;
  const code = e?.code;
  const looksLikeAuthRejection =
    status === 401 ||
    status === 403 ||
    /invalid api key|jwt|not authorized|permission denied/i.test(message);

  const detail = `name=${e?.name ?? "Unknown"} code=${code ?? "n/a"} status=${status ?? "n/a"} message=${message}`;

  if (looksLikeAuthRejection) {
    return {
      log: `[${context}] Supabase rejected the service role key — ${detail}`,
      userMessage:
        `Supabase rejected the service role key (${e?.name ?? "AuthApiError"}${status ? `, status ${status}` : ""}` +
        `${code ? `, code ${code}` : ""}: ${message}). Verify SUPABASE_SERVICE_ROLE_KEY is the current, ` +
        "un-truncated service_role key from the same Supabase project as NEXT_PUBLIC_SUPABASE_URL, and that " +
        "it hasn't been rotated/regenerated in Supabase since it was last copied into Vercel.",
    };
  }

  return {
    log: `[${context}] ${detail}`,
    userMessage: `Could not load users (${e?.name ?? "Error"}: ${message}).`,
  };
}
