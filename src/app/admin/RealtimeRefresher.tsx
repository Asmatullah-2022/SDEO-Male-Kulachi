"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Invisible component: subscribes to Postgres changes on daily_enrollment
 * and re-runs the Admin Overview's server-side data fetch whenever a row is
 * inserted or updated — e.g. a teacher submitting via the public
 * /enrollment portal — so Today's Submission Monitor, pending counts, and
 * the trend chart update without the admin manually reloading the page.
 *
 * Requires Realtime to be enabled for public.daily_enrollment (see
 * supabase/schema.sql). Uses the browser client, so it's subject to the
 * same RLS as any other authenticated read here — an admin's session
 * already has full SELECT access via the existing is_admin() policy, so no
 * additional policy is needed for this to work.
 */
export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-daily-enrollment-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_enrollment" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
