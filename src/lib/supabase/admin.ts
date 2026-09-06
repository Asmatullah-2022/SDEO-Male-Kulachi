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
 * Thrown when SUPABASE_SERVICE_ROLE_KEY is present but its own embedded
 * claims prove it can't be correct — e.g. it's an `anon` key, not
 * `service_role`, or it was issued for a different Supabase project than
 * NEXT_PUBLIC_SUPABASE_URL. Detected from the key's own (non-secret) JWT
 * payload — never guessed.
 */
export class SupabaseAdminKeyMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAdminKeyMismatchError";
  }
}

/**
 * TEMPORARY DIAGNOSTIC — logs whether the required env vars are present in
 * *this specific running function invocation*, plus which Vercel
 * environment/deployment served the request. NEVER logs the actual secret
 * value — only `true`/`false` and its character length.
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
 * Extracts the project ref from a Supabase URL, e.g.
 * "https://abcdefgh.supabase.co" -> "abcdefgh".
 */
function projectRefFromUrl(url: string): string | null {
  const match = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Best-effort, non-secret inspection of a Supabase API key's own claims.
 * Supabase keys come in two formats:
 *  - Legacy JWT keys (start with "eyJ") whose payload includes `role`
 *    ("anon" | "service_role") and often a project `ref`.
 *  - New opaque keys (e.g. "sb_secret_...") which carry no decodable
 *    claims at all.
 * Decoding the JWT payload does NOT expose the secret — the payload is
 * plain base64 metadata; the actual secret is the key's signature, which
 * is never read or logged here.
 */
function inspectSupabaseKey(key: string): { format: "jwt" | "opaque"; role?: string; ref?: string } {
  const parts = key.split(".");
  if (parts.length !== 3) return { format: "opaque" };

  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { role?: string; ref?: string };
    return { format: "jwt", role: payload.role, ref: payload.ref };
  } catch {
    return { format: "opaque" };
  }
}

/**
 * Server-only Supabase client using the service role key. Never import this
 * file from a Client Component — it bypasses Row Level Security entirely.
 *
 * Beyond checking the vars are merely present, this also validates (when
 * the key format allows it) that the key actually claims to be a
 * `service_role` key and that it was issued for the same project as
 * NEXT_PUBLIC_SUPABASE_URL — the two most common reasons a present-but-
 * wrong key produces an AuthApiError instead of working.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new SupabaseAdminConfigError("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new SupabaseAdminConfigError("SUPABASE_SERVICE_ROLE_KEY");

  const keyInfo = inspectSupabaseKey(serviceRoleKey);
  if (keyInfo.format === "jwt") {
    if (keyInfo.role && keyInfo.role !== "service_role") {
      throw new SupabaseAdminKeyMismatchError(
        `SUPABASE_SERVICE_ROLE_KEY's own embedded claims say its role is "${keyInfo.role}", not ` +
          `"service_role". You likely pasted the anon/public key into this variable by mistake — ` +
          `open Supabase → Project Settings → API and copy the "service_role" key specifically ` +
          `(it's below the anon key, usually behind a "reveal" toggle).`
      );
    }

    const urlRef = projectRefFromUrl(url);
    if (keyInfo.ref && urlRef && keyInfo.ref.toLowerCase() !== urlRef) {
      throw new SupabaseAdminKeyMismatchError(
        `SUPABASE_SERVICE_ROLE_KEY belongs to Supabase project "${keyInfo.ref}", but ` +
          `NEXT_PUBLIC_SUPABASE_URL points to project "${urlRef}". They must be the service_role key ` +
          `and URL from the SAME Supabase project — copy both from the same project's API settings page.`
      );
    }
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
