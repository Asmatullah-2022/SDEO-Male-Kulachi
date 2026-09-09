import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeAdminError } from "@/lib/supabase/admin-error";

function normalizeDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.length === 10) return `92${digits}`;
  return digits;
}

/**
 * Public endpoint the registration form calls before creating an
 * account, to check whether a mobile number is already registered to
 * another profile. Best-effort UX check only — there is no uniqueness
 * constraint on profiles.mobile_number in the database (adding one was
 * out of scope here, per "do not modify database tables unless
 * absolutely necessary"), so this can't fully close a race between two
 * simultaneous registrations. It still catches the common case (a
 * teacher re-registering, or mistyping a colleague's number) before an
 * account is created, same service-role pattern as
 * /api/login/resolve-identifier's lookup.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const mobileNumber = typeof body?.mobile_number === "string" ? body.mobile_number : "";
  const normalized = normalizeDigits(mobileNumber);
  if (!normalized) return NextResponse.json({ exists: false });

  try {
    const admin = createAdminClient();
    const { data: profiles, error } = await admin.from("profiles").select("mobile_number");
    if (error) throw error;

    const exists = (profiles ?? []).some((p) => p.mobile_number && normalizeDigits(p.mobile_number) === normalized);
    return NextResponse.json({ exists });
  } catch (err) {
    const { log } = describeAdminError(err, "POST /api/register/check-mobile");
    console.error(log);
    // Fail open: never block registration over a check that itself
    // failed — worst case a duplicate mobile number needs a manual
    // correction later, which is far better than blocking every teacher
    // from registering because of an unrelated hiccup in this check.
    return NextResponse.json({ exists: false });
  }
}
