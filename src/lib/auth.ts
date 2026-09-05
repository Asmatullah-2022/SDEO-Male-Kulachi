import { createClient } from "@/lib/supabase/server";
import type { Profile, School } from "@/lib/types";

export interface CurrentUser {
  profile: Profile;
  school: School | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  let school: School | null = null;
  if (profile.school_id) {
    const { data } = await supabase
      .from("schools")
      .select("*")
      .eq("id", profile.school_id)
      .single();
    school = data ?? null;
  }

  return { profile, school };
}
