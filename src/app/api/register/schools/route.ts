import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeAdminError, logSupabaseError } from "@/lib/supabase/admin-error";

/**
 * Public endpoint for the /register page's School Name dropdown: lists
 * active schools, same minimal shape and same service-role pattern as the
 * long-working /api/enrollment/schools. Returns just id/name/EMIS code —
 * via the service-role client rather than a new public RLS policy on
 * `schools` or `profiles`.
 *
 * Additionally tries to exclude schools that already have a headteacher
 * (TASK 3 — one headteacher per school) as a UX convenience. That lookup
 * is deliberately best-effort and never allowed to take the whole
 * dropdown down: if it fails for any reason, we log it and fall back to
 * the full active school list rather than a hard error, because the
 * actual guarantee that a school can never end up with two headteacher
 * accounts is the existing profiles_school_id_headteacher_unique partial
 * index in the database — enforced at signup regardless of what this
 * list shows.
 */
export async function GET() {
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    const { log } = describeAdminError(err, "GET /api/register/schools (createAdminClient)");
    console.error(log);
    return NextResponse.json(
      { error: "Could not load the school list. Please try again in a moment." },
      { status: 500 }
    );
  }

  const { data: schools, error: schoolsError } = await admin
    .from("schools")
    .select("id, school_name, emis_code")
    .eq("status", "active")
    .order("school_name");

  if (schoolsError) {
    logSupabaseError("GET /api/register/schools:schools.select", schoolsError);
    return NextResponse.json(
      { error: "Could not load the school list. Please try again in a moment." },
      { status: 500 }
    );
  }

  let assignedIds = new Set<string>();
  const { data: assigned, error: assignedError } = await admin
    .from("profiles")
    .select("school_id")
    .eq("role", "headteacher");

  if (assignedError) {
    // Non-fatal: log it and show the full active list rather than fail
    // the whole dropdown over this secondary lookup.
    logSupabaseError("GET /api/register/schools:profiles.select (non-fatal, showing all active schools)", assignedError);
  } else {
    assignedIds = new Set((assigned ?? []).map((p) => p.school_id).filter((id): id is string => Boolean(id)));
  }

  const available = (schools ?? []).filter((s) => !assignedIds.has(s.id));
  return NextResponse.json({ schools: available });
}
