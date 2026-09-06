import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeAdminError, logSupabaseError } from "@/lib/supabase/admin-error";
import { publicEnrollmentSubmitSchema } from "@/lib/validation";
import { todayISO } from "@/lib/date";

/**
 * Public endpoint backing the /enrollment portal's submit button.
 *
 * SECURITY NOTE: this intentionally requires no login, per the current
 * product decision to let any teacher who knows a school's EMIS code submit
 * that school's daily figures without an account. That is a real, informed
 * trade-off (EMIS codes are not secret), not an oversight — the code is
 * structured so it can be tightened later without a rewrite:
 *   - All writes go through this one server-side route using the
 *     service-role client. No public/anon RLS policy was added to
 *     `daily_enrollment` or `schools` — the existing authenticated-only
 *     policies are completely untouched, so the authenticated Headteacher
 *     flow's security is unaffected.
 *   - The row's `user_id` is always the school's own assigned headteacher
 *     profile (looked up server-side, never trusted from the client), so a
 *     future switch to real teacher accounts only needs to swap "look up
 *     the assigned headteacher" for "read the authenticated session" here.
 *   - `total_enrollment` is always computed server-side from the other four
 *     fields — a submitted total is never trusted or accepted.
 *   - Writes reuse the existing daily_enrollment table and its existing
 *     UNIQUE (school_id, report_date) constraint, so a school can never end
 *     up with two different totals for the same day regardless of which
 *     portal (this one or the authenticated /submit-report) was used, and
 *     the Admin Dashboard reflects both without any extra merging logic.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = publicEnrollmentSubmitSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { emis_code, dropout, public_admission, private_admission, fresh_admission } = result.data;
  const totalEnrollment = dropout + public_admission + private_admission + fresh_admission;

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    const { log } = describeAdminError(err, "POST /api/enrollment/submit (createAdminClient)");
    console.error(log);
    return NextResponse.json(
      { error: "Server is temporarily unavailable. Please try again in a moment." },
      { status: 500 }
    );
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, school_name, emis_code, status")
    .eq("emis_code", emis_code)
    .maybeSingle();

  if (schoolError) {
    logSupabaseError("POST /api/enrollment/submit:schools.select", schoolError);
    return NextResponse.json({ error: "Could not look up that school. Please try again." }, { status: 500 });
  }
  if (!school || school.status !== "active") {
    return NextResponse.json(
      { error: "No active school was found with that EMIS code. Please check and try again." },
      { status: 404 }
    );
  }

  const { data: headteacher, error: headteacherError } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("school_id", school.id)
    .eq("role", "headteacher")
    .maybeSingle();

  if (headteacherError) {
    logSupabaseError("POST /api/enrollment/submit:profiles.select", headteacherError);
    return NextResponse.json({ error: "Could not look up the headteacher for this school." }, { status: 500 });
  }
  if (!headteacher) {
    return NextResponse.json(
      {
        error:
          "This school has no assigned headteacher account yet, so an online submission can't be recorded. " +
          "Please contact the SDEO (Male) Kulachi office.",
      },
      { status: 400 }
    );
  }

  const reportDate = todayISO();
  const { data: saved, error: upsertError } = await admin
    .from("daily_enrollment")
    .upsert(
      {
        school_id: school.id,
        user_id: headteacher.id,
        report_date: reportDate,
        dropout,
        public_admission,
        private_admission,
        fresh_admission,
        total_enrollment: totalEnrollment,
      },
      { onConflict: "school_id,report_date" }
    )
    .select()
    .single();

  if (upsertError) {
    logSupabaseError("POST /api/enrollment/submit:daily_enrollment.upsert", upsertError);
    return NextResponse.json(
      { error: "Something went wrong while saving your report. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    schoolName: school.school_name,
    emisCode: school.emis_code,
    headteacherName: headteacher.full_name,
    report: saved,
  });
}
