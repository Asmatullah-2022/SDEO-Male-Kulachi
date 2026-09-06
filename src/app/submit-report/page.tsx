import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SubmitReportForm } from "./SubmitReportForm";
import { Alert } from "@/components/Alert";

export default async function SubmitReportPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role === "admin") redirect("/admin");

  if (!current.school) {
    return (
      <main className="flex min-h-dvh flex-col bg-brand-50">
        <Header title="SDEO Kulachi" subtitle="Daily Enrollment Form" />
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <Alert type="warning">
            Your account is not yet assigned to a school. Please contact the SDEO (Male) Kulachi office.
          </Alert>
        </div>
        <BottomNav />
      </main>
    );
  }

  const supabase = await createClient();
  const today = todayISO();
  const { data: existingReport } = await supabase
    .from("daily_enrollment")
    .select("*")
    .eq("school_id", current.school.id)
    .eq("report_date", today)
    .maybeSingle();

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi" subtitle="Daily Enrollment Form" />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <SubmitReportForm
          school={current.school}
          userId={current.profile.id}
          headteacherName={current.profile.full_name}
          today={today}
          existingReport={existingReport}
        />
      </div>
      <BottomNav />
    </main>
  );
}
