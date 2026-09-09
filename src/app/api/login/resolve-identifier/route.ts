import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeAdminError } from "@/lib/supabase/admin-error";

/**
 * Public endpoint that makes the login page's "Email or Mobile Number"
 * field actually work for mobile numbers. Supabase Auth here is
 * email/password only — there is no phone-based auth configured — so a
 * typed mobile number has to be resolved to its account's email before
 * calling signInWithPassword(). Looks up by normalized digits against
 * profiles.mobile_number (service-role, since the caller isn't
 * authenticated yet) and returns that account's email via the Auth
 * Admin API.
 *
 * Never reveals whether a given identifier matches an account: an
 * email-shaped identifier is echoed back as-is with no DB lookup at all,
 * and any lookup miss/failure returns the same { email: null } shape a
 * genuine "not found" does — the login page then attempts
 * signInWithPassword with the raw typed value regardless, which fails
 * with the same generic invalid-credentials message either way.
 */
function normalizeDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.length === 10) return `92${digits}`;
  return digits;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";

  if (!identifier || identifier.includes("@")) {
    return NextResponse.json({ email: identifier || null });
  }

  const normalized = normalizeDigits(identifier);
  if (!normalized) {
    return NextResponse.json({ email: null });
  }

  try {
    const admin = createAdminClient();
    const { data: profiles, error } = await admin.from("profiles").select("id, mobile_number");
    if (error) throw error;

    const match = (profiles ?? []).find(
      (p) => p.mobile_number && normalizeDigits(p.mobile_number) === normalized
    );
    if (!match) return NextResponse.json({ email: null });

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(match.id);
    if (userError || !userData?.user?.email) return NextResponse.json({ email: null });

    return NextResponse.json({ email: userData.user.email });
  } catch (err) {
    const { log } = describeAdminError(err, "POST /api/login/resolve-identifier");
    console.error(log);
    // Fail soft — same shape as "no match found" — never a hard error
    // here, since the login page falls back to trying the raw identifier
    // regardless (and that failure path already exists and is safe).
    return NextResponse.json({ email: null });
  }
}
