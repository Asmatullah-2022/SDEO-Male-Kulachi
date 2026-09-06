import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeAdminError } from "@/lib/supabase/admin-error";

/**
 * Public endpoint: lists active schools for the /enrollment portal's
 * search-by-name step. Deliberately returns ONLY id/name/EMIS code — never
 * headteacher names or mobile numbers — so no staff contact information is
 * exposed to an unauthenticated caller. Reads via the service-role client
 * rather than relaxing RLS, so the `schools` table's existing
 * authenticated-only SELECT policy is untouched.
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("schools")
      .select("id, school_name, emis_code")
      .eq("status", "active")
      .order("school_name");
    if (error) throw error;

    return NextResponse.json({ schools: data ?? [] });
  } catch (err) {
    const { log } = describeAdminError(err, "GET /api/enrollment/schools");
    console.error(log);
    return NextResponse.json(
      { error: "Could not load the school list. Please try again in a moment." },
      { status: 500 }
    );
  }
}
