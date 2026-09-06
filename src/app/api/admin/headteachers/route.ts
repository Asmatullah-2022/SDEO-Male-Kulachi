import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, logEnvPresence } from "@/lib/supabase/admin";
import { describeAdminError } from "@/lib/supabase/admin-error";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- referenced only by the commented-out real GET handler below (temporary diagnostic mode)
import { getUsersWithEmail } from "@/lib/services/users";
import { headteacherSchema } from "@/lib/validation";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

// ============================================================================
// TEMPORARY DIAGNOSTIC — GET /api/admin/headteachers
// ----------------------------------------------------------------------------
// The real GET handler (list users, below this block, commented out) is
// swapped out for a bare env-var probe while we track down why
// SUPABASE_SERVICE_ROLE_KEY isn't reaching the deployed function. This
// intentionally skips auth so it can be curled/opened directly with no
// session cookie needed. It NEVER returns the key's value — only whether
// it's present and how many characters long it is.
//
// Side effect: the Users page's "Refresh" button will show this JSON
// instead of the real user list until this is reverted. The initial page
// load is unaffected (it fetches via a Server Component, not this route).
//
// TO REVERT: delete this block and uncomment the real handler below it.
// ============================================================================
export async function GET() {
  logEnvPresence("GET /api/admin/headteachers (diagnostic mode)");
  return NextResponse.json({
    present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  });
}

// --- Real handler, temporarily disabled — see block above ------------------
// export async function GET() {
//   logEnvPresence("GET /api/admin/headteachers");
//   const admin = await requireAdmin();
//   if (!admin) {
//     return NextResponse.json({ error: "Not authorized." }, { status: 403 });
//   }
//
//   try {
//     const supabase = await createClient();
//     const users = await getUsersWithEmail(supabase, createAdminClient());
//     return NextResponse.json({ users });
//   } catch (err) {
//     const { log, userMessage } = describeAdminError(err, "GET /api/admin/headteachers");
//     console.error(log);
//     return NextResponse.json({ error: userMessage }, { status: 500 });
//   }
// }

export async function POST(request: NextRequest) {
  logEnvPresence("POST /api/admin/headteachers");
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json();
  const result = headteacherSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { full_name, email, mobile_number, password, school_id } = result.data;

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (err) {
    const { log, userMessage } = describeAdminError(err, "POST /api/admin/headteachers (createAdminClient)");
    console.error(log);
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: "headteacher" },
  });

  if (createError || !created.user) {
    const isDuplicate =
      createError?.code === "email_exists" ||
      /already been registered|already exists|already registered/i.test(createError?.message ?? "");
    if (!isDuplicate) {
      console.error(`[POST /api/admin/headteachers] auth.admin.createUser failed: ${createError?.message}`);
    }
    return NextResponse.json(
      {
        error: isDuplicate
          ? "An account with this email address already exists. Please use a different email."
          : createError?.message ?? "Could not create user account.",
      },
      { status: 400 }
    );
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ full_name, mobile_number, school_id, role: "headteacher" })
    .eq("id", created.user.id);

  if (profileError) {
    console.error(`[POST /api/admin/headteachers] profiles update failed: ${profileError.message}`);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id, email });
}
