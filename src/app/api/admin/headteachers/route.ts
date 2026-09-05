import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  try {
    const supabase = await createClient();
    const users = await getUsersWithEmail(supabase, createAdminClient());
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Could not load users. Please try again." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
  const adminClient = createAdminClient();

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
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id, email });
}
