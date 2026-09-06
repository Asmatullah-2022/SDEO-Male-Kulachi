"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSchools } from "@/lib/services/schools";
import { todayISO, isValidISODate, formatDisplayDate } from "@/lib/date";
import { buildAbsenceReminderMessage, buildWhatsAppDeepLink, toWhatsAppNumber } from "@/lib/whatsapp";
import { prefetchAdminData, useAdminCache } from "@/lib/adminCache";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Alert } from "@/components/Alert";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { StatGridSkeleton, TableSkeleton } from "@/components/Skeleton";
import { EnrollmentTrendChart } from "./EnrollmentTrendChart";
import { MonitorTable, type MonitorRow } from "./MonitorTable";
import { RealtimeRefresher } from "./RealtimeRefresher";
import type { HeadteacherUser, School, DailyEnrollment } from "@/lib/types";

async function fetchHeadteachers(): Promise<HeadteacherUser[]> {
  const res = await fetch("/api/admin/headteachers");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Could not load users.");
  return json.users as HeadteacherUser[];
}

async function fetchEnrollmentForDate(date: string): Promise<DailyEnrollment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("daily_enrollment").select("*").eq("report_date", date);
  if (error) throw error;
  return (data as DailyEnrollment[]) ?? [];
}

interface TrendRow {
  report_date: string;
  total_enrollment: number;
}

async function fetchTrendRows(date: string): Promise<TrendRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_enrollment")
    .select("report_date, total_enrollment")
    .lte("report_date", date)
    .order("report_date", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as TrendRow[]) ?? [];
}

/**
 * Client-driven Overview tab. Replaces the old per-navigation Server
 * Component data fetch: all data now comes from the shared adminCache
 * (see src/lib/adminCache.ts), which is fetched once and reused across
 * every tab switch — switching to Schools/Users and back no longer
 * re-runs any Supabase query. See the top of AdminNav's usage for the
 * rationale; this is the piece the "instant tabs" performance work added.
 */
export function OverviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = todayISO();
  const rawDate = searchParams.get("date");
  const selectedDate = isValidISODate(rawDate) ? rawDate : today;
  const isToday = selectedDate === today;

  const schoolsCache = useAdminCache<School[]>("schools", () => getSchools(createClient()));
  const usersCache = useAdminCache<HeadteacherUser[]>("adminUsers", fetchHeadteachers);
  const enrollmentCache = useAdminCache<DailyEnrollment[]>(`enrollment:${selectedDate}`, () =>
    fetchEnrollmentForDate(selectedDate)
  );
  const trendCache = useAdminCache<TrendRow[]>(`trend:${selectedDate}`, () => fetchTrendRows(selectedDate));

  // Background prefetch: Schools/Users tabs read the same "schools" and
  // "adminUsers" cache keys Overview just populated, so by the time the
  // admin taps those tabs the data is already sitting in memory.
  useEffect(() => {
    prefetchAdminData("schools", () => getSchools(createClient()));
    prefetchAdminData("adminUsers", fetchHeadteachers);
  }, []);

  const schools = schoolsCache.data;
  const users = usersCache.data;
  const reportsForDate = enrollmentCache.data;
  const trendRows = trendCache.data;

  const initialLoading =
    (schoolsCache.loading && !schools) ||
    (usersCache.loading && !users) ||
    (enrollmentCache.loading && !reportsForDate) ||
    (trendCache.loading && !trendRows);

  const loadError = schoolsCache.error || usersCache.error || enrollmentCache.error || trendCache.error;

  const derived = useMemo(() => {
    if (!schools || !users || !reportsForDate || !trendRows) return null;

    const headteacherBySchoolId = new Map<string, { name: string; mobile: string | null }>();
    users.forEach((u) => {
      if (u.role === "headteacher" && u.school_id) {
        headteacherBySchoolId.set(u.school_id, { name: u.full_name, mobile: u.mobile_number });
      }
    });
    const totalHeadteachers = users.filter((u) => u.role === "headteacher").length;

    const activeSchools = schools.filter((s) => s.status === "active");
    const reportBySchoolId = new Map(reportsForDate.map((r) => [r.school_id, r]));
    const submittedCount = reportsForDate.length;
    const pendingSchools = activeSchools.filter((s) => !reportBySchoolId.has(s.id));

    const totals = reportsForDate.reduce(
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
    trendRows.forEach((r) => {
      const entry = trendByDate.get(r.report_date) ?? { date: r.report_date, total: 0 };
      entry.total += r.total_enrollment;
      trendByDate.set(r.report_date, entry);
    });
    const trendData = Array.from(trendByDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const monitorRows: MonitorRow[] = schools.map((s) => {
      const report = reportBySchoolId.get(s.id);
      const headteacher = headteacherBySchoolId.get(s.id);
      return {
        schoolId: s.id,
        schoolName: s.school_name,
        emisCode: s.emis_code,
        headteacherName: headteacher?.name ?? null,
        headteacherMobile: headteacher?.mobile ?? null,
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

    return {
      totalSchoolCount: schools.length,
      totalHeadteachers,
      submittedCount,
      pendingSchools,
      totals,
      trendData,
      monitorRows,
      pendingWithHeadteacher,
    };
  }, [schools, users, reportsForDate, trendRows]);

  function handleRefreshAll() {
    schoolsCache.refresh();
    usersCache.refresh();
    enrollmentCache.refresh();
    trendCache.refresh();
  }

  function handleDateChange(e: React.ChangeEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  const reminderMessage = useMemo(() => buildAbsenceReminderMessage(), []);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
      <RealtimeRefresher />
      {loadError && <Alert type="error">{loadError}</Alert>}

      <Card>
        <form
          onSubmit={handleDateChange}
          onChange={(e) => {
            const value = (e.currentTarget.elements.namedItem("date") as HTMLInputElement)?.value;
            if (value) router.push(value === today ? "/admin" : `/admin?date=${value}`);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="date" className="text-xs font-semibold text-brand-900">
              View data for date
            </label>
            <Input id="date" name="date" type="date" defaultValue={selectedDate} max={today} className="py-2.5" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="px-4 py-2.5 text-sm"
            onClick={handleRefreshAll}
            loading={initialLoading}
          >
            ↻ Refresh
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

      {initialLoading || !derived ? (
        <>
          <StatGridSkeleton />
          <Card>
            <TableSkeleton rows={4} />
          </Card>
          <Card>
            <TableSkeleton rows={6} />
          </Card>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            <StatCard label="Total Schools" value={derived.totalSchoolCount} icon="🏫" />
            <StatCard label="Total Headteachers" value={derived.totalHeadteachers} icon="👤" />
            <StatCard label="Reports Submitted" value={derived.submittedCount} tone="brand" icon="✅" />
            <StatCard label="Pending Reports" value={derived.pendingSchools.length} tone="amber" icon="⏳" />
            <StatCard label="Fresh Admissions" value={derived.totals.fresh} tone="blue" icon="🆕" />
            <StatCard label="Dropouts" value={derived.totals.dropout} tone="red" icon="📉" />
            <StatCard label="Public Admissions" value={derived.totals.publicAdm} tone="blue" icon="🏛️" />
            <StatCard label="Private Admissions" value={derived.totals.privateAdm} tone="blue" icon="🏢" />
          </div>

          <Card>
            <p className="mb-3 text-sm font-bold text-brand-900">Daily Enrollment Trend (last 14 days)</p>
            {derived.trendData.length === 0 ? (
              <EmptyState
                icon="📈"
                title="No data yet"
                description="Trends will appear once schools start submitting reports."
              />
            ) : (
              <EnrollmentTrendChart data={derived.trendData} />
            )}
          </Card>

          <Card>
            <p className="mb-3 text-sm font-bold text-brand-900">
              Today&apos;s Submission Monitor ({derived.monitorRows.length} schools)
            </p>
            {derived.monitorRows.length === 0 ? (
              <EmptyState icon="🏫" title="No schools registered yet" />
            ) : (
              <MonitorTable
                rows={derived.monitorRows}
                selectedDateDisplay={formatDisplayDate(selectedDate)}
                remindersEnabled={isToday}
              />
            )}
          </Card>

          <Card>
            <p className="mb-3 text-sm font-bold text-brand-900">
              Pending Schools ({derived.pendingWithHeadteacher.length})
            </p>
            {derived.pendingWithHeadteacher.length === 0 ? (
              <EmptyState icon="🎉" title="All active schools have submitted this date's report!" />
            ) : (
              <>
                <div className="divide-y divide-brand-50 sm:hidden">
                  {derived.pendingWithHeadteacher.map(({ school, headteacher }) => {
                    const waNumber = toWhatsAppNumber(headteacher?.mobile ?? null);
                    return (
                      <div key={school.id} className="py-3">
                        <p className="font-semibold text-brand-900">{school.school_name}</p>
                        <p className="text-xs text-gray-500">EMIS: {school.emis_code}</p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                          <div>
                            <dt className="text-gray-400">Headteacher</dt>
                            <dd>{headteacher?.name ?? "Not assigned"}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-400">Mobile</dt>
                            <dd>{headteacher?.mobile ?? "—"}</dd>
                          </div>
                        </dl>
                        {isToday && waNumber ? (
                          <a
                            href={buildWhatsAppDeepLink(reminderMessage, waNumber)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1ebc59]"
                          >
                            💬 Remind
                          </a>
                        ) : (
                          <p className="mt-2 text-xs text-gray-400">
                            {isToday ? "No mobile number" : "Reminders only available for today"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto sm:block">
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
                      {derived.pendingWithHeadteacher.map(({ school, headteacher }) => {
                        const waNumber = toWhatsAppNumber(headteacher?.mobile ?? null);
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
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
