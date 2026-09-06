"use client";

import { createClient } from "@/lib/supabase/client";
import type { DailyEnrollment, Profile, School } from "@/lib/types";

/**
 * Client-side data fetchers for the Headteacher Dashboard, meant to be used
 * with the shared cache hook in src/lib/adminCache.ts (a generic
 * fetch-once-and-reuse cache keyed by string — despite the file name, it
 * has no Admin-specific logic, so reusing it here doesn't touch or risk
 * anything on the Admin side).
 *
 * Home ("myProfile" + "myReports"), Submit ("myProfile" + "myReports"),
 * and History ("myProfile" + "myReports") all read the exact same two
 * cache entries, fetched once and shared across every tab switch — that's
 * what makes switching between them instant instead of re-querying
 * Supabase (and re-running auth.getUser()) on every navigation.
 */

export interface MyProfileData {
  profile: Profile;
  school: School | null;
  email: string | null;
}

export async function fetchMyProfile(): Promise<MyProfileData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error || !profile) throw new Error("Could not load your profile. Please try again.");

  let school: School | null = null;
  if (profile.school_id) {
    const { data } = await supabase.from("schools").select("*").eq("id", profile.school_id).single();
    school = data ?? null;
  }

  return { profile, school, email: user.email ?? null };
}

export async function fetchMyReports(): Promise<DailyEnrollment[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).single();
  if (!profile?.school_id) return [];

  const { data, error } = await supabase
    .from("daily_enrollment")
    .select("*")
    .eq("school_id", profile.school_id)
    .order("report_date", { ascending: false });
  if (error) throw error;
  return (data as DailyEnrollment[]) ?? [];
}
