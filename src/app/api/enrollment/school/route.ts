import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeAdminError } from "@/lib/supabase/admin-error";
import { todayISO } from "@/lib/date";

/**
 * Public endpoint: given an EMIS code, returns the school's identity, its
 * assigned headteacher's name (name only — never mobile number, which stays
 * server-side/admin-only), and whether today's report has already been
 * submitted (with the existing figures, for the Edit/Update flow). Uses the
 * service-role client — no new public RLS policy was added for this.
 */
export async function GET(request: NextRequest) {
  const emisCode = request.nextUrl.searchParams.get("emis_code")?.trim();
  if (!emisCode) {
    return NextResponse.json({ error: "EMIS code is required." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, school_name, emis_code, status")
      .eq("emis_code", emisCode)
      .maybeSingle();
    if (schoolError) throw schoolError;

    if (!school || school.status !== "active") {
      return NextResponse.json(
        { error: "No active school was found with that EMIS code. Please check and try again." },
        { status: 404 }
      );
    }

    const { data: headteacher, error: headteacherError } = await admin
      .from("profiles")
      .select("full_name")
      .eq("school_id", school.id)
      .eq("role", "headteacher")
      .maybeSingle();
    if (headteacherError) throw headteacherError;

    const today = todayISO();
    const { data: existing, error: existingError } = await admin
      .from("daily_enrollment")
      .select("dropout, public_admission, private_admission, fresh_admission, total_enrollment, submitted_at")
      .eq("school_id", school.id)
      .eq("report_date", today)
      .maybeSingle();
    if (existingError) throw existingError;

    return NextResponse.json({
      schoolId: school.id,
      schoolName: school.school_name,
      emisCode: school.emis_code,
      headteacherName: headteacher?.full_name ?? null,
      hasHeadteacher: Boolean(headteacher),
      reportDate: today,
      existing: existing ?? null,
    });
  } catch (err) {
    const { log } = describeAdminError(err, "GET /api/enrollment/school");
    console.error(log);
    return NextResponse.json(
      { error: "Could not look up that school. Please try again in a moment." },
      { status: 500 }
    );
  }
}
