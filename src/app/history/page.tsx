import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { HistoryExplorer } from "./HistoryExplorer";
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
        {!current.school ? (
          <EmptyState icon="🏫" title="No school assigned" description="Contact the SDEO office for assistance." />
        ) : reports.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No submissions yet"
            description="Your submitted daily enrollment reports will appear here."
          />
        ) : (
          <HistoryExplorer reports={reports} today={todayISO()} />
        )}
      </div>

      <BottomNav />
    </main>
  );
}
