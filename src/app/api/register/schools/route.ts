import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeAdminError } from "@/lib/supabase/admin-error";

/**
 * Public endpoint for the /register page's School Name dropdown: lists
 * only active schools that do NOT already have a headteacher assigned
 * (TASK 3 — one headteacher per school). Returns just id/name/EMIS code,
 * same minimal shape as /api/enrollment/schools, via the service-role
 * client rather than a new public RLS policy on `schools` or `profiles`.
 *
 * This list is a UX convenience only — the actual guarantee that a school
 * can never end up with two headteacher accounts is the existing
 * profiles_school_id_headteacher_unique partial index in the database, so
 * a stale/cached list here can never cause a real double-assignment.
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    const [{ data: schools, error: schoolsError }, { data: assigned, error: assignedError }] = await Promise.all([
      admin.from("schools").select("id, school_name, emis_code").eq("status", "active").order("school_name"),
      admin.from("profiles").select("school_id").eq("role", "headteacher").not("school_id", "is", null),
    ]);
    if (schoolsError) throw schoolsError;
    if (assignedError) throw assignedError;

    const assignedIds = new Set((assigned ?? []).map((p) => p.school_id));
    const available = (schools ?? []).filter((s) => !assignedIds.has(s.id));

    return NextResponse.json({ schools: available });
  } catch (err) {
    const { log } = describeAdminError(err, "GET /api/register/schools");
    console.error(log);
    return NextResponse.json(
      { error: "Could not load the school list. Please try again in a moment." },
      { status: 500 }
    );
  }
}
