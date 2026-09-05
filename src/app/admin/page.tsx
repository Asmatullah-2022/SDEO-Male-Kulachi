import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSchoolCount, getSchools } from "@/lib/services/schools";
import { todayISO } from "@/lib/date";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Alert } from "@/components/Alert";
import { EnrollmentTrendChart } from "./EnrollmentTrendChart";
import type { School } from "@/lib/types";

export default async function AdminOverviewPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const today = todayISO();

  let totalSchoolCount = 0;
  let allSchools: School[] = [];
  let schoolsError: string | null = null;
  try {
    [totalSchoolCount, allSchools] = await Promise.all([getSchoolCount(supabase), getSchools(supabase)]);
  } catch {
    schoolsError = "Could not connect to the schools database. Please refresh the page or try again shortly.";
  }

  const [{ data: todaysReports }, { data: trendRows }] = await Promise.all([
    supabase.from("daily_enrollment").select("*").eq("report_date", today),
    supabase
      .from("daily_enrollment")
      .select("report_date, dropout, public_admission, private_admission, fresh_admission, total_enrollment")
      .order("report_date", { ascending: false })
      .limit(500),
  ]);

  const activeSchools = allSchools.filter((s) => s.status === "active");
  const submittedSchoolIds = new Set((todaysReports ?? []).map((r) => r.school_id));
  const pendingSchools = activeSchools.filter((s) => !submittedSchoolIds.has(s.id));

  const totals = (todaysReports ?? []).reduce(
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

  let pendingWithHeadteacher: { school: School; name: string | null; mobile: string | null }[] = [];
  if (pendingSchools.length > 0) {
    const { data: headteachers } = await supabase
      .from("profiles")
      .select("full_name, mobile_number, school_id")
      .in("school_id", pendingSchools.map((s) => s.id));

    pendingWithHeadteacher = pendingSchools.map((s) => {
      const ht = headteachers?.find((h) => h.school_id === s.id);
      return { school: s, name: ht?.full_name ?? null, mobile: ht?.mobile_number ?? null };
    });
  }

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="SDEO Office Dashboard" homeHref="/admin" />
      <AdminNav />

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        {schoolsError && <Alert type="error">{schoolsError}</Alert>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Schools" value={totalSchoolCount} icon="🏫" />
          <StatCard label="Submitted Today" value={submittedSchoolIds.size} tone="brand" icon="✅" />
          <StatCard label="Pending Schools" value={pendingSchools.length} tone="amber" icon="⏳" />
          <StatCard label="Fresh Admissions" value={totals.fresh} tone="blue" icon="🆕" />
          <StatCard label="Public Admissions" value={totals.publicAdm} tone="blue" icon="🏛️" />
          <StatCard label="Private Admissions" value={totals.privateAdm} tone="blue" icon="🏢" />
          <StatCard label="Dropouts Today" value={totals.dropout} tone="red" icon="📉" />
          <StatCard label="Active Schools" value={activeSchools.length} icon="🟢" />
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
            Pending Schools ({pendingWithHeadteacher.length})
          </p>
          {pendingWithHeadteacher.length === 0 ? (
            <EmptyState icon="🎉" title="All schools have submitted today's report!" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-gray-500">
                    <th className="py-2 pr-2">School Name</th>
                    <th className="py-2 pr-2">EMIS Code</th>
                    <th className="py-2 pr-2">Headteacher</th>
                    <th className="py-2 pr-2">Mobile</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWithHeadteacher.map(({ school, name, mobile }) => (
                    <tr key={school.id} className="border-b border-brand-50">
                      <td className="py-2 pr-2 font-medium text-brand-900">{school.school_name}</td>
                      <td className="py-2 pr-2 text-gray-600">{school.emis_code}</td>
                      <td className="py-2 pr-2 text-gray-600">{name ?? "Not assigned"}</td>
                      <td className="py-2 pr-2 text-gray-600">{mobile ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
