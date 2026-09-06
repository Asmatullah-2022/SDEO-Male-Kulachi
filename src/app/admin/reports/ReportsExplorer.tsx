"use client";

import { useMemo, useState } from "react";
import type { DailyEnrollment, HeadteacherUser, School } from "@/lib/types";
import { todayISO, formatDateTime, formatDisplayDate } from "@/lib/date";
import { toCSV, downloadCSV } from "@/lib/csv";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { EnrollmentTrendChart } from "../EnrollmentTrendChart";
import { SchoolComparisonChart } from "../SchoolComparisonChart";

interface Props {
  reports: DailyEnrollment[];
  schools: School[];
  users: HeadteacherUser[];
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export function ReportsExplorer({ reports, schools, users }: Props) {
  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));

  const schoolById = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const headteacherBySchoolId = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.role === "headteacher" && u.school_id) map.set(u.school_id, u.full_name);
    });
    return map;
  }, [users]);

  // ---- Daily view: reports for the selected date, optionally narrowed by search ----
  const reportsForDate = useMemo(
    () => reports.filter((r) => r.report_date === selectedDate),
    [reports, selectedDate]
  );

  const query = search.trim().toLowerCase();
  const matchesQuery = (schoolId: string) => {
    if (!query) return true;
    const school = schoolById.get(schoolId);
    if (!school) return false;
    return school.school_name.toLowerCase().includes(query) || school.emis_code.toLowerCase().includes(query);
  };

  const filteredReports = useMemo(
    () =>
      reportsForDate
        .filter((r) => matchesQuery(r.school_id))
        .sort((a, b) => (schoolById.get(a.school_id)?.school_name ?? "").localeCompare(
          schoolById.get(b.school_id)?.school_name ?? ""
        )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reportsForDate, query, schoolById]
  );

  const activeSchools = useMemo(() => schools.filter((s) => s.status === "active"), [schools]);
  const submittedSchoolIds = useMemo(() => new Set(reportsForDate.map((r) => r.school_id)), [reportsForDate]);
  const pendingSchools = useMemo(
    () => activeSchools.filter((s) => !submittedSchoolIds.has(s.id) && matchesQuery(s.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSchools, submittedSchoolIds, query]
  );

  const totals = useMemo(
    () =>
      reportsForDate.reduce(
        (acc, r) => {
          acc.fresh += r.fresh_admission;
          acc.publicAdm += r.public_admission;
          acc.privateAdm += r.private_admission;
          acc.dropout += r.dropout;
          return acc;
        },
        { fresh: 0, publicAdm: 0, privateAdm: 0, dropout: 0 }
      ),
    [reportsForDate]
  );

  // ---- Monthly Analytics ----
  const monthReports = useMemo(
    () => reports.filter((r) => r.report_date.startsWith(selectedMonth)),
    [reports, selectedMonth]
  );

  const dailyTrend = useMemo(() => {
    const byDate = new Map<string, { date: string; total: number }>();
    monthReports.forEach((r) => {
      const entry = byDate.get(r.report_date) ?? { date: r.report_date, total: 0 };
      entry.total += r.total_enrollment;
      byDate.set(r.report_date, entry);
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [monthReports]);

  const monthlyTotals = useMemo(
    () =>
      monthReports.reduce(
        (acc, r) => {
          acc.fresh += r.fresh_admission;
          acc.publicAdm += r.public_admission;
          acc.privateAdm += r.private_admission;
          acc.dropout += r.dropout;
          acc.submissions += 1;
          return acc;
        },
        { fresh: 0, publicAdm: 0, privateAdm: 0, dropout: 0, submissions: 0 }
      ),
    [monthReports]
  );

  const schoolComparison = useMemo(() => {
    const totalBySchool = new Map<string, number>();
    monthReports.forEach((r) => {
      totalBySchool.set(r.school_id, (totalBySchool.get(r.school_id) ?? 0) + r.total_enrollment);
    });
    return Array.from(totalBySchool.entries())
      .map(([schoolId, total]) => ({
        schoolName: schoolById.get(schoolId)?.school_name ?? "Unknown School",
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [monthReports, schoolById]);

  function handleExportCSV() {
    const rows = filteredReports.map((r, i) => ({
      "S.No": i + 1,
      "School Name": schoolById.get(r.school_id)?.school_name ?? "",
      "EMIS Code": schoolById.get(r.school_id)?.emis_code ?? "",
      "Headteacher Name": headteacherBySchoolId.get(r.school_id) ?? "Not Assigned",
      "Drop Out": r.dropout,
      Public: r.public_admission,
      Private: r.private_admission,
      "Fresh Admission": r.fresh_admission,
      "Total Enrollment": r.total_enrollment,
      "Submitted At": formatDateTime(r.submitted_at),
    }));
    downloadCSV(`enrollment-report-${selectedDate}.csv`, toCSV(rows));
  }

  return (
    <div className="space-y-6">
      {/* Print-only official letterhead */}
      <div className="hidden print:block">
        <div className="border-b-2 border-black pb-3 text-center">
          <p className="text-lg font-bold">Office of the Sub-Divisional Education Officer (Male), Kulachi</p>
          <p className="text-sm">District Dera Ismail Khan</p>
          <p className="mt-2 text-base font-semibold">Daily Enrollment Report — {formatDisplayDate(selectedDate)}</p>
          <p className="text-xs text-gray-600">Generated on {formatDateTime(new Date().toISOString())}</p>
        </div>
      </div>

      <Card className="print:hidden">
        <p className="mb-3 text-sm font-bold text-brand-900">Filters</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Date"
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Input
              label="Search School Name or EMIS Code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Government Primary School or 14501"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {selectedDate !== today && (
            <button
              type="button"
              onClick={() => setSelectedDate(today)}
              className="text-xs font-semibold text-brand-700 underline underline-offset-2"
            >
              ← Back to Today
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={handleExportCSV}>
            ⬇️ Export to CSV / Excel
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            🖨️ Print Report
          </Button>
        </div>
      </Card>

      {/* Summary cards for the selected date */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 print:grid-cols-4">
        <StatCard label="Total Schools" value={schools.length} icon="🏫" />
        <StatCard label="Reports Submitted" value={reportsForDate.length} tone="brand" icon="✅" />
        <StatCard label="Pending Reports" value={activeSchools.length - submittedSchoolIds.size} tone="amber" icon="⏳" />
        <StatCard label="Fresh Admissions" value={totals.fresh} tone="blue" icon="🆕" />
        <StatCard label="Public Admissions" value={totals.publicAdm} tone="blue" icon="🏛️" />
        <StatCard label="Private Admissions" value={totals.privateAdm} tone="blue" icon="🏢" />
        <StatCard label="Dropouts" value={totals.dropout} tone="red" icon="📉" />
      </div>

      {/* Submitted reports table */}
      <Card>
        <p className="mb-3 text-sm font-bold text-brand-900 print:text-black">
          Submitted Reports for {formatDisplayDate(selectedDate)} ({filteredReports.length})
        </p>
        {filteredReports.length === 0 ? (
          <EmptyState icon="📄" title="No reports found for this date" />
        ) : (
          <>
            {/* Mobile card list — avoids horizontal scrolling on small screens (screen only, not print) */}
            <div className="divide-y divide-brand-50 sm:hidden print:hidden">
              {filteredReports.map((r, i) => {
                const school = schoolById.get(r.school_id);
                return (
                  <div key={r.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-900">
                          {i + 1}. {school?.school_name ?? "—"}
                        </p>
                        <p className="text-xs text-gray-500">EMIS: {school?.emis_code ?? "—"}</p>
                        <p className="text-xs text-gray-500">
                          Headteacher: {headteacherBySchoolId.get(r.school_id) ?? "Not Assigned"}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                      <div className="rounded-lg bg-brand-50 p-1.5">
                        <dt className="text-[10px] text-gray-500">Drop Out</dt>
                        <dd className="font-bold text-brand-900">{r.dropout}</dd>
                      </div>
                      <div className="rounded-lg bg-brand-50 p-1.5">
                        <dt className="text-[10px] text-gray-500">Public</dt>
                        <dd className="font-bold text-brand-900">{r.public_admission}</dd>
                      </div>
                      <div className="rounded-lg bg-brand-50 p-1.5">
                        <dt className="text-[10px] text-gray-500">Private</dt>
                        <dd className="font-bold text-brand-900">{r.private_admission}</dd>
                      </div>
                      <div className="rounded-lg bg-brand-50 p-1.5">
                        <dt className="text-[10px] text-gray-500">Fresh</dt>
                        <dd className="font-bold text-brand-900">{r.fresh_admission}</dd>
                      </div>
                    </dl>
                    <p className="mt-1 text-right text-xs font-semibold text-brand-800">
                      Total Enrollment: {r.total_enrollment}
                    </p>
                    <p className="mt-1 text-right text-xs text-gray-400">
                      Submitted: {formatDateTime(r.submitted_at)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Desktop/tablet table (also used for print) */}
            <div className="hidden overflow-x-auto sm:block print:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-gray-500 print:text-black">
                    <th className="py-2 pr-2">S.No</th>
                    <th className="py-2 pr-2">School Name</th>
                    <th className="py-2 pr-2">EMIS Code</th>
                    <th className="py-2 pr-2">Headteacher</th>
                    <th className="py-2 pr-2">Drop Out</th>
                    <th className="py-2 pr-2">Public</th>
                    <th className="py-2 pr-2">Private</th>
                    <th className="py-2 pr-2">Fresh</th>
                    <th className="py-2 pr-2">Total</th>
                    <th className="py-2 pr-2">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((r, i) => {
                    const school = schoolById.get(r.school_id);
                    return (
                      <tr key={r.id} className="border-b border-brand-50">
                        <td className="py-2 pr-2">{i + 1}</td>
                        <td className="py-2 pr-2 font-medium text-brand-900 print:text-black">
                          {school?.school_name ?? "—"}
                        </td>
                        <td className="py-2 pr-2">{school?.emis_code ?? "—"}</td>
                        <td className="py-2 pr-2">{headteacherBySchoolId.get(r.school_id) ?? "Not Assigned"}</td>
                        <td className="py-2 pr-2">{r.dropout}</td>
                        <td className="py-2 pr-2">{r.public_admission}</td>
                        <td className="py-2 pr-2">{r.private_admission}</td>
                        <td className="py-2 pr-2">{r.fresh_admission}</td>
                        <td className="py-2 pr-2 font-semibold">{r.total_enrollment}</td>
                        <td className="py-2 pr-2 text-gray-500">{formatDateTime(r.submitted_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Pending schools for the selected date */}
      <Card>
        <p className="mb-3 text-sm font-bold text-brand-900 print:text-black">
          Pending Schools for {formatDisplayDate(selectedDate)} ({pendingSchools.length})
        </p>
        {pendingSchools.length === 0 ? (
          <EmptyState icon="🎉" title="All active schools have submitted this date's report!" />
        ) : (
          <>
            <div className="divide-y divide-brand-50 sm:hidden print:hidden">
              {pendingSchools.map((s) => (
                <div key={s.id} className="py-3">
                  <p className="font-semibold text-brand-900">{s.school_name}</p>
                  <p className="text-xs text-gray-500">EMIS: {s.emis_code}</p>
                  <p className="text-xs text-gray-500">
                    Headteacher: {headteacherBySchoolId.get(s.id) ?? "Not assigned"}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block print:block">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-gray-500 print:text-black">
                    <th className="py-2 pr-2">School Name</th>
                    <th className="py-2 pr-2">EMIS Code</th>
                    <th className="py-2 pr-2">Headteacher</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSchools.map((s) => (
                    <tr key={s.id} className="border-b border-brand-50">
                      <td className="py-2 pr-2 font-medium text-brand-900 print:text-black">{s.school_name}</td>
                      <td className="py-2 pr-2">{s.emis_code}</td>
                      <td className="py-2 pr-2">{headteacherBySchoolId.get(s.id) ?? "Not assigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Monthly Analytics — screen only, charts don't belong in the printed official report */}
      <Card className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-brand-900">
            Monthly Analytics — {MONTH_LABEL_FORMATTER.format(new Date(`${selectedMonth}-01T00:00:00`))}
          </p>
          <Input
            type="month"
            value={selectedMonth}
            max={today.slice(0, 7)}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-auto py-1.5 text-sm"
          />
        </div>

        {monthReports.length === 0 ? (
          <EmptyState icon="📊" title="No submissions for this month yet" />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Submissions" value={monthlyTotals.submissions} icon="📄" />
              <StatCard label="Fresh Admissions" value={monthlyTotals.fresh} tone="blue" icon="🆕" />
              <StatCard label="Public Admissions" value={monthlyTotals.publicAdm} tone="blue" icon="🏛️" />
              <StatCard label="Private Admissions" value={monthlyTotals.privateAdm} tone="blue" icon="🏢" />
              <StatCard label="Dropouts" value={monthlyTotals.dropout} tone="red" icon="📉" />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">Daily Enrollment Trend</p>
              <EnrollmentTrendChart data={dailyTrend} />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500">Top Schools by Total Enrollment</p>
              <SchoolComparisonChart data={schoolComparison} />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
