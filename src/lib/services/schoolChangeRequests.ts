import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolChangeRequest } from "@/lib/types";

/**
 * Reusable Supabase data-access functions for `school_change_requests`.
 * All calls here go through the authenticated client — RLS (see
 * supabase/schema.sql) does the real enforcement: a headteacher can only
 * insert/select their own request, and only an admin can update
 * (approve/reject) one. No service-role client is used anywhere in this
 * file.
 */

export async function getMyPendingSchoolChangeRequest(
  supabase: SupabaseClient,
  headteacherId: string
): Promise<SchoolChangeRequest | null> {
  const { data, error } = await supabase
    .from("school_change_requests")
    .select("*")
    .eq("headteacher_id", headteacherId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;
  return (data as SchoolChangeRequest) ?? null;
}

export async function submitSchoolChangeRequest(
  supabase: SupabaseClient,
  input: {
    headteacher_id: string;
    current_school_id: string | null;
    requested_school_id: string;
    reason: string | null;
  }
): Promise<SchoolChangeRequest> {
  const { data, error } = await supabase.from("school_change_requests").insert(input).select().single();
  if (error) throw error;
  return data as SchoolChangeRequest;
}

export async function getPendingSchoolChangeRequests(supabase: SupabaseClient): Promise<SchoolChangeRequest[]> {
  const { data, error } = await supabase
    .from("school_change_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return (data as SchoolChangeRequest[]) ?? [];
}

export async function resolveSchoolChangeRequest(
  supabase: SupabaseClient,
  id: string,
  input: { status: "approved" | "rejected"; resolved_by: string }
): Promise<SchoolChangeRequest> {
  const { data, error } = await supabase
    .from("school_change_requests")
    .update({ status: input.status, resolved_by: input.resolved_by, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as SchoolChangeRequest;
}
