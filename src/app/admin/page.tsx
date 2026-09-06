import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSchoolCount, getSchools } from "@/lib/services/schools";
import { todayISO, isValidISODate, formatDisplayDate } from "@/lib/date";
import { buildAbsenceReminderMessage, buildWhatsAppDeepLink, toWhatsAppNumber } from "@/lib/whatsapp";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Alert } from "@/components/Alert";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { EnrollmentTrendChart } from "./EnrollmentTrendChart";
import { MonitorTable, type MonitorRow } from "./MonitorTable";
import type { School } from "@/lib/types";

interface HeadteacherInfo {
  name: string;
  mobile: string | null;
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const today = todayISO();
  const selectedDate = isValidISODate(params.date) ? params.date : today;
  const isToday = selectedDate === today;

  const supabase = await createClient();

  let totalSchoolCount = 0;
  let allSchools: School[] = [];
  let schoolsError: string | null = null;
  try {
    [totalSchoolCount, allSchools] = await Promise.all([getSchoolCount(supabase), getSchools(supabase)]);
  } catch {
    schoolsError = "Could not connect to the schools database. Please refresh the page or try again shortly.";
  }

  const [{ data: headteacherProfiles }, { data: reportsForDate }, { data: trendRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, mobile_number, school_id").eq("role", "headteacher"),
    supabase.from("daily_enrollment").select("*").eq("report_date", selectedDate),
    supabase
      .from("daily_enrollment")
      .select("report_date, dropout, public_admission, private_admission, fresh_admission, total_enrollment")
      .lte("report_date", selectedDate)
      .order("report_date", { ascending: false })
      .limit(500),
  ]);

  const headteacherBySchoolId = new Map<string, HeadteacherInfo>();
  (headteacherProfiles ?? []).forEach((p) => {
    if (p.school_id) headteacherBySchoolId.set(p.school_id, { name: p.full_name, mobile: p.mobile_number });
  });
  const totalHeadteachers = (headteacherProfiles ?? []).length;

  const activeSchools = allSchools.filter((s) => s.status === "active");
  const reportBySchoolId = new Map((reportsForDate ?? []).map((r) => [r.school_id, r]));
  const submittedCount = reportsForDate?.length ?? 0;
  const pendingSchools = activeSchools.filter((s) => !reportBySchoolId.has(s.id));

  const totals = (reportsForDate ?? []).reduce(
    (acc, r) => {
      acc.fresh += r.fresh_admission;
      acc.publicAdm += r.public_admission;
      acc.privateAdm += r.private_admission;
      acc.dropout += r.dropout;
      return acc;
    },
    { fresh: 0, publicAdm: 0, privateAdm: 0, dropout: 0 }
  );

  const trendByDate = new Map<string, { date: string; total: number }>();
  (trendRows ?? []).forEach((r) => {
    const entry = trendByDate.get(r.report_date) ?? { date: r.report_date, total: 0 };
    entry.total += r.total_enrollment;
    trendByDate.set(r.report_date, entry);
  });
  const trendData = Array.from(trendByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const monitorRows: MonitorRow[] = allSchools.map((s) => {
    const report = reportBySchoolId.get(s.id);
    return {
      schoolId: s.id,
      schoolName: s.school_name,
      emisCode: s.emis_code,
      headteacherName: headteacherBySchoolId.get(s.id)?.name ?? null,
      submitted: Boolean(report),
      dropout: report?.dropout ?? 0,
      publicAdmission: report?.public_admission ?? 0,
      privateAdmission: report?.private_admission ?? 0,
      freshAdmission: report?.fresh_admission ?? 0,
      totalEnrollment: report?.total_enrollment ?? 0,
    };
  });

  const pendingWithHeadteacher = pendingSchools.map((s) => ({
    school: s,
    headteacher: headteacherBySchoolId.get(s.id) ?? null,
  }));

  const reminderMessage = buildAbsenceReminderMessage();

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="SDEO Office Dashboard" homeHref="/admin" />
      <AdminNav />

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        {schoolsError && <Alert type="error">{schoolsError}</Alert>}

        <Card>
          <form action="/admin" method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="date" className="text-xs font-semibold text-brand-900">
                View data for date
              </label>
              <Input id="date" name="date" type="date" defaultValue={selectedDate} max={today} className="py-2.5" />
            </div>
            <Button type="submit" className="px-5 py-2.5">
              View
            </Button>
            {!isToday && (
              <a href="/admin" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
                ← Back to Today
              </a>
            )}
          </form>
          {!isToday && (
            <p className="mt-2 text-xs text-amber-700">
              Showing data for {formatDisplayDate(selectedDate)}, not today.
            </p>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Schools" value={totalSchoolCount} icon="🏫" />
          <StatCard label="Total Headteachers" value={totalHeadteachers} icon="👤" />
          <StatCard label="Reports Submitted" value={submittedCount} tone="brand" icon="✅" />
          <StatCard label="Pending Reports" value={pendingSchools.length} tone="amber" icon="⏳" />
          <StatCard label="Fresh Admissions" value={totals.fresh} tone="blue" icon="🆕" />
          <StatCard label="Dropouts" value={totals.dropout} tone="red" icon="📉" />
          <StatCard label="Public Admissions" value={totals.publicAdm} tone="blue" icon="🏛️" />
          <StatCard label="Private Admissions" value={totals.privateAdm} tone="blue" icon="🏢" />
        </div>

        <Card>
          <p className="mb-3 text-sm font-bold text-brand-900">Daily Enrollment Trend (last 14 days)</p>
          {trendData.length === 0 ? (
            <EmptyState icon="📈" title="No data yet" description="Trends will appear once schools start submitting reports." />
          ) : (
            <EnrollmentTrendChart data={trendData} />
          )}
        </Card>

        <Card>
          <p className="mb-3 text-sm font-bold text-brand-900">
            Today&apos;s Submission Monitor ({monitorRows.length} schools)
          </p>
          {monitorRows.length === 0 ? (
            <EmptyState icon="🏫" title="No schools registered yet" />
          ) : (
            <MonitorTable rows={monitorRows} />
          )}
        </Card>

        <Card>
          <p className="mb-3 text-sm font-bold text-brand-900">
            Pending Schools ({pendingWithHeadteacher.length})
          </p>
          {pendingWithHeadteacher.length === 0 ? (
            <EmptyState icon="🎉" title="All active schools have submitted this date's report!" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-gray-500">
                    <th className="py-2 pr-2">School Name</th>
                    <th className="py-2 pr-2">EMIS Code</th>
                    <th className="py-2 pr-2">Headteacher</th>
                    <th className="py-2 pr-2">Mobile</th>
                    <th className="py-2 pr-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWithHeadteacher.map(({ school, headteacher }) => {
                    const waNumber = toWhatsAppNumber(headteacher?.mobile);
                    return (
                      <tr key={school.id} className="border-b border-brand-50">
                        <td className="py-2 pr-2 font-medium text-brand-900">{school.school_name}</td>
                        <td className="py-2 pr-2 text-gray-600">{school.emis_code}</td>
                        <td className="py-2 pr-2 text-gray-600">{headteacher?.name ?? "Not assigned"}</td>
                        <td className="py-2 pr-2 text-gray-600">{headteacher?.mobile ?? "—"}</td>
                        <td className="py-2 pr-2">
                          {isToday && waNumber ? (
                            <a
                              href={buildWhatsAppDeepLink(reminderMessage, waNumber)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1ebc59]"
                            >
                              💬 Remind
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {isToday ? "No mobile number" : "Only for today"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
