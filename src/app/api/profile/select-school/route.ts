import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeAdminError, logSupabaseError } from "@/lib/supabase/admin-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lets a headteacher self-assign their FIRST school. Every check here is
 * server-side and keyed off the caller's own authenticated session
 * (never a client-supplied user id) — self-only, first-time-only, and
 * duplicate-assignment checks are all enforced in this route rather than
 * relying on RLS, because the actual database write has to go through
 * the service-role client: profiles_restrict_self_update (schema.sql)
 * unconditionally blocks a non-admin from changing their own school_id
 * via a normal authenticated update, first assignment or not. That
 * trigger is left completely untouched — this route is the one narrow,
 * fully-audited gateway for the one case it doesn't (and shouldn't)
 * allow directly. Any later change goes through school_change_requests
 * and admin approval instead — see src/app/profile/ProfileClient.tsx.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in to select a school." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const schoolId = typeof body?.school_id === "string" ? body.school_id : "";
  if (!UUID_RE.test(schoolId)) {
    return NextResponse.json({ error: "Select a valid school." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Could not load your profile. Please try again." }, { status: 400 });
  }
  if (profile.role !== "headteacher") {
    return NextResponse.json({ error: "Only Headteacher accounts can select a school." }, { status: 403 });
  }
  if (profile.school_id) {
    return NextResponse.json(
      { error: "You already have an assigned school. Submit a school change request to update it." },
      { status: 409 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    const { log, userMessage } = describeAdminError(err, "POST /api/profile/select-school (createAdminClient)");
    console.error(log);
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .maybeSingle();
  if (schoolError) {
    logSupabaseError("POST /api/profile/select-school:schools.select", schoolError);
    return NextResponse.json({ error: "Could not look up that school. Please try again." }, { status: 500 });
  }
  if (!school || school.status !== "active") {
    return NextResponse.json({ error: "This school could not be found. Please refresh and try again." }, { status: 404 });
  }

  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId)
    .eq("role", "headteacher")
    .maybeSingle();
  if (existingError) {
    logSupabaseError("POST /api/profile/select-school:profiles.select (assignment check)", existingError);
    return NextResponse.json({ error: "Could not verify school availability. Please try again." }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      {
        error:
          "This school is already assigned to another Headteacher. Please contact the SDEO (Male) Kulachi office.",
      },
      { status: 409 }
    );
  }

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ school_id: schoolId })
    .eq("id", user.id)
    .select()
    .single();

  if (updateError) {
    logSupabaseError("POST /api/profile/select-school:profiles.update", updateError);
    const isDuplicate = /duplicate key|unique constraint/i.test(updateError.message ?? "");
    return NextResponse.json(
      {
        error: isDuplicate
          ? "This school is already assigned to another Headteacher. Please contact the SDEO (Male) Kulachi office."
          : "Could not select this school. Please try again.",
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ profile: updated, school });
}
