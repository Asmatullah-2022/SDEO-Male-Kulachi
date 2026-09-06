import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * TEMPORARY DIAGNOSTIC ENDPOINT.
 *
 * Reports whether required env vars are present in *this exact running
 * deployment*, without ever revealing their values — only booleans and
 * character lengths, plus Vercel's own (non-secret) deployment metadata.
 *
 * Why this exists: env vars are baked into a Vercel deployment at build/
 * runtime-init time. Adding or changing a var in the dashboard does NOT
 * retroactively update deployments that already exist — only a new
 * deployment (a fresh push, or "Redeploy" from the dashboard) picks up the
 * new value. This endpoint lets you confirm, from the live function
 * itself, whether the var actually reached it — instead of guessing from
 * the dashboard UI alone.
 *
 * Admin-only. Safe to leave in place; remove later if you prefer.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const describe = (value: string | undefined) => ({
    present: Boolean(value),
    length: value?.length ?? 0,
  });

  return NextResponse.json({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: describe(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: describe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: describe(process.env.SUPABASE_SERVICE_ROLE_KEY),
      NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER: describe(process.env.NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER),
    },
    deployment: {
      vercelEnv: process.env.VERCEL_ENV ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelUrl: process.env.VERCEL_URL ?? null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    },
  });
}
