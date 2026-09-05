import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDisplayDate } from "@/lib/date";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import type { DailyEnrollment } from "@/lib/types";

export default async function HistoryPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role === "admin") redirect("/admin");

  let reports: DailyEnrollment[] = [];
  if (current.school) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("daily_enrollment")
      .select("*")
      .eq("school_id", current.school.id)
      .order("report_date", { ascending: false });
    reports = data ?? [];
  }

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi" subtitle="Submission History" />

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {reports.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No submissions yet"
            description="Your submitted daily enrollment reports will appear here."
          />
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <Card key={r.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-brand-900">{formatDisplayDate(r.report_date)}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(r.submitted_at)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-5">
                  <Metric label="Drop Out" value={r.dropout} />
                  <Metric label="Public" value={r.public_admission} />
                  <Metric label="Private" value={r.private_admission} />
                  <Metric label="Fresh" value={r.fresh_admission} />
                  <Metric label="Total" value={r.total_enrollment} highlight />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? "bg-brand-100" : "bg-brand-50"}`}>
      <p className="text-gray-500">{label}</p>
      <p className={`text-sm font-bold ${highlight ? "text-brand-800" : "text-brand-900"}`}>{value}</p>
    </div>
  );
}
