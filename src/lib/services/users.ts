import type { SupabaseClient } from "@supabase/supabase-js";
import type { HeadteacherUser } from "@/lib/types";

/**
 * Fetches all profiles joined with their auth email address.
 * Requires a service-role client for `auth.admin.listUsers()` — never call
 * this from a Client Component or with the anon/browser client.
 */
export async function getUsersWithEmail(
  supabase: SupabaseClient,
  adminClient: SupabaseClient
): Promise<HeadteacherUser[]> {
  const { data: profiles, error } = await supabase.from("profiles").select("*").order("full_name");
  if (error) throw error;

  const { data: authList, error: authError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) throw authError;

  const emailById = new Map(authList.users.map((u) => [u.id, u.email ?? null]));
  return (profiles ?? []).map((p) => ({ ...p, email: emailById.get(p.id) ?? null }));
}
