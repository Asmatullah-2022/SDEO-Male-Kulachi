import type { SupabaseClient } from "@supabase/supabase-js";
import type { HeadteacherUser, Profile } from "@/lib/types";
import { logSupabaseError } from "@/lib/supabase/admin-error";

/**
 * Fetches all profiles joined with their auth email address.
 * Requires a service-role client for `auth.admin.listUsers()` — never call
 * this from a Client Component or with the anon/browser client.
 *
 * Each Supabase call is logged individually on failure so Vercel's
 * Function Logs show exactly which operation broke (the profiles table
 * query vs. the Auth admin API), rather than one generic error.
 */
export async function getUsersWithEmail(
  supabase: SupabaseClient,
  adminClient: SupabaseClient
): Promise<HeadteacherUser[]> {
  const { data: profiles, error } = await supabase.from("profiles").select("*").order("full_name");
  if (error) {
    logSupabaseError("getUsersWithEmail:profiles.select", error);
    throw error;
  }

  const { data: authList, error: authError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) {
    logSupabaseError("getUsersWithEmail:auth.admin.listUsers", authError);
    throw authError;
  }

  const emailById = new Map(authList.users.map((u) => [u.id, u.email ?? null]));
  return (profiles ?? []).map((p) => ({ ...p, email: emailById.get(p.id) ?? null }));
}

/**
 * Updates only full_name and mobile_number on a profile — used by both the
 * headteacher's own Profile page and the admin's User Management edit
 * action. Never touches email, role, or school_id (school reassignment
 * has its own dedicated control). RLS plus the profiles_restrict_self_
 * update trigger enforce this same restriction at the database level
 * regardless of what this function is called with.
 */
export async function updateProfileNameAndMobile(
  supabase: SupabaseClient,
  id: string,
  input: { full_name: string; mobile_number: string }
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: input.full_name, mobile_number: input.mobile_number })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}
