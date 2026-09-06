"use client";

import { createClient } from "@/lib/supabase/client";
import { getSchools } from "@/lib/services/schools";
import { useAdminCache } from "@/lib/adminCache";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { TableSkeleton } from "@/components/Skeleton";
import type { DailyEnrollment, School } from "@/lib/types";
import { ReportsExplorer } from "./ReportsExplorer";

async function fetchReports(): Promise<DailyEnrollment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_enrollment")
    .select("*")
    .order("report_date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data as DailyEnrollment[]) ?? [];
}

/**
 * Reports data is deliberately NOT prefetched in the background (unlike
 * Schools/Users) — it's the least-visited tab and the heaviest query (up to
 * 1000 rows), so it only loads the first time an admin actually opens it.
 * Once loaded it's cached the same as every other tab: instant on repeat
 * visits, refreshed only by the button below. Schools reuses the same
 * "schools" cache key Overview/Schools/Users already share.
 */
export function ReportsClient() {
  const reportsCache = useAdminCache<DailyEnrollment[]>("reports", fetchReports);
  const schoolsCache = useAdminCache<School[]>("schools", () => getSchools(createClient()));

  const loading = (reportsCache.loading && !reportsCache.data) || (schoolsCache.loading && !schoolsCache.data);
  const error = reportsCache.error || schoolsCache.error;

  if (loading) {
    return (
      <Card>
        <TableSkeleton rows={8} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <div className="flex justify-end print:hidden">
        <Button
          type="button"
          variant="outline"
          className="px-3 py-2 text-sm"
          onClick={() => {
            reportsCache.refresh();
            schoolsCache.refresh();
          }}
        >
          ↻ Refresh
        </Button>
      </div>
      <ReportsExplorer reports={reportsCache.data ?? []} schools={schoolsCache.data ?? []} />
    </div>
  );
}
