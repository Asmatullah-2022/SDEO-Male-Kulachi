"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  onChange: () => void;
}

/**
 * Invisible component: subscribes to Postgres changes on daily_enrollment
 * and calls `onChange` whenever a row is inserted or updated — e.g. a
 * headteacher submitting a report — so Today's Submission Monitor, pending
 * counts, and the trend chart update without the admin manually reloading.
 *
 * Calls `onChange` via a ref rather than depending on it directly, so the
 * realtime subscription is opened once on mount and never torn down/
 * reopened just because the parent re-rendered with a new inline callback.
 *
 * Requires Realtime to be enabled for public.daily_enrollment (see
 * supabase/schema.sql). Uses the browser client, so it's subject to the
 * same RLS as any other authenticated read here — an admin's session
 * already has full SELECT access via the existing is_admin() policy, so no
 * additional policy is needed for this to work.
 */
export function RealtimeRefresher({ onChange }: Props) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-daily-enrollment-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_enrollment" },
        () => {
          onChangeRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
