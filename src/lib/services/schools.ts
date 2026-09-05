import type { SupabaseClient } from "@supabase/supabase-js";
import type { School, SchoolStatus } from "@/lib/types";

export interface SchoolInput {
  school_name: string;
  emis_code: string;
  district: string;
  tehsil: string;
  circle: string | null;
  status: SchoolStatus;
}

/**
 * Reusable Supabase data-access functions for the `schools` table.
 * Each function accepts an already-created Supabase client (browser or
 * server) so the same logic works from both Server Components and
 * Client Components without duplicating query code.
 */

export async function getSchools(supabase: SupabaseClient): Promise<School[]> {
  const { data, error } = await supabase.from("schools").select("*").order("school_name");
  if (error) throw error;
  return (data as School[]) ?? [];
}

export async function getSchoolCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from("schools").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function addSchool(supabase: SupabaseClient, input: SchoolInput): Promise<School> {
  const { data, error } = await supabase.from("schools").insert(input).select().single();
  if (error) throw error;
  return data as School;
}

export async function updateSchool(supabase: SupabaseClient, id: string, input: SchoolInput): Promise<School> {
  const { data, error } = await supabase.from("schools").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as School;
}

export async function deleteSchool(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) throw error;
}
