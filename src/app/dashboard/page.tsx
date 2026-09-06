import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO, formatDisplayDate, formatDateTime } from "@/lib/date";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { StatCard } from "@/components/StatCard";
import type { DailyEnrollment } from "@/lib/types";

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role === "admin") redirect("/admin");
  if (!current.school) {
    return (
      <main className="flex min-h-dvh flex-col bg-brand-50">
        <Header title="SDEO Kulachi" subtitle="Headteacher Dashboard" />
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <Alert type="warning">
            Your account is not yet assigned to a school. Please contact the SDEO (Male) Kulachi office.
          </Alert>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: todaysReport }, { data: monthReports }, { data: latestReport }] = await Promise.all([
    supabase
      .from("daily_enrollment")
      .select("*")
      .eq("school_id", current.school.id)
      .eq("report_date", today)
      .maybeSingle(),
    supabase
      .from("daily_enrollment")
      .select("id")
      .eq("school_id", current.school.id)
      .gte("report_date", monthStart)
      .lte("report_date", today),
    supabase
      .from("daily_enrollment")
      .select("report_date, submitted_at")
      .eq("school_id", current.school.id)
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const submitted = Boolean(todaysReport);
  const report = todaysReport as DailyEnrollment | null;
  const monthlyCount = monthReports?.length ?? 0;

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi" subtitle="Headteacher Dashboard" />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        {/* User information */}
        <Card>
          <p className="text-sm text-gray-500">Welcome,</p>
          <p className="text-lg font-bold text-brand-900">{current.profile.full_name}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-gray-500">Email</p>
              <p className="break-all font-semibold text-brand-900">{current.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Mobile Number</p>
              <p className="font-semibold text-brand-900">{current.profile.mobile_number ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">School Name</p>
              <p className="font-semibold text-brand-900">{current.school.school_name}</p>
            </div>
            <div>
              <p className="text-gray-500">EMIS Code</p>
              <p className="font-semibold text-brand-900">{current.school.emis_code}</p>
            </div>
          </div>
        </Card>

        {/* Report submission status */}
        <Card className={submitted ? "bg-brand-50" : "bg-amber-50"}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today&apos;s Report Status</p>
              <p className={`text-lg font-bold ${submitted ? "text-brand-700" : "text-amber-700"}`}>
                {submitted ? "✅ Submitted" : "⏳ Pending"}
              </p>
            </div>
            <span className="text-3xl">{submitted ? "✅" : "⏳"}</span>
          </div>
          {latestReport && (
            <div className="mt-3 border-t border-dashed border-brand-100 pt-3 text-xs text-gray-500">
              <p>Last Submitted Date: {formatDisplayDate(latestReport.report_date)}</p>
              <p>Last Submission Time: {formatDateTime(latestReport.submitted_at)}</p>
            </div>
          )}
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <StatCard label="Fresh Admissions" value={report?.fresh_admission ?? 0} tone="blue" icon="🆕" />
          <StatCard label="Public Admissions" value={report?.public_admission ?? 0} tone="blue" icon="🏛️" />
          <StatCard label="Private Admissions" value={report?.private_admission ?? 0} tone="blue" icon="🏢" />
          <StatCard label="Dropouts" value={report?.dropout ?? 0} tone="red" icon="📉" />
          <StatCard label="Total Enrollment" value={report?.total_enrollment ?? 0} tone="brand" icon="📚" />
          <StatCard label="Monthly Reports Submitted" value={monthlyCount} icon="🗓️" />
        </div>

        <div className="flex flex-col gap-3">
          {!submitted ? (
            <Link href="/submit-report">
              <Button fullWidth>📝 Submit Daily Enrollment</Button>
            </Link>
          ) : (
            <Link href="/submit-report">
              <Button fullWidth variant="secondary">✏️ Update Today&apos;s Submission</Button>
            </Link>
          )}
          <Link href="/history">
            <Button fullWidth variant="outline">📊 View Submission History</Button>
          </Link>
          <a href="/dashboard#contact">
            <Button fullWidth variant="ghost">☎️ Contact SDEO Office</Button>
          </a>
        </div>

        <Card id="contact">
          <p className="text-sm font-bold text-brand-900">Contact SDEO (Male) Kulachi</p>
          <p className="mt-1 text-sm text-gray-600">
            For any issues with login, school assignment, or data corrections, please contact the SDEO
            office directly through the official WhatsApp number provided by your office.
          </p>
        </Card>
      </div>

      <BottomNav />
    </main>
  );
}
