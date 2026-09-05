"use client";

import { useMemo, useState } from "react";
import type { DailyEnrollment, School } from "@/lib/types";
import { formatDateTime, formatDisplayDate } from "@/lib/date";
import { toCSV, downloadCSV } from "@/lib/csv";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";

export function ReportsExplorer({ reports, schools }: { reports: DailyEnrollment[]; schools: School[] }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [emisSearch, setEmisSearch] = useState("");

  const schoolById = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (dateFrom && r.report_date < dateFrom) return false;
      if (dateTo && r.report_date > dateTo) return false;
      if (schoolId && r.school_id !== schoolId) return false;
      if (emisSearch) {
        const emis = schoolById.get(r.school_id)?.emis_code ?? "";
        if (!emis.toLowerCase().includes(emisSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [reports, dateFrom, dateTo, schoolId, emisSearch, schoolById]);

  function handleExportCSV() {
    const rows = filtered.map((r) => ({
      Date: formatDisplayDate(r.report_date),
      "School Name": schoolById.get(r.school_id)?.school_name ?? "",
      "EMIS Code": schoolById.get(r.school_id)?.emis_code ?? "",
      "Drop Out": r.dropout,
      Public: r.public_admission,
      Private: r.private_admission,
      "Fresh Admission": r.fresh_admission,
      "Total Enrollment": r.total_enrollment,
      "Submitted At": formatDateTime(r.submitted_at),
    }));
    downloadCSV(`enrollment-reports-${Date.now()}.csv`, toCSV(rows));
  }

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <p className="mb-3 text-sm font-bold text-brand-900">Filters</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input label="From Date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="To Date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Select label="School" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">All Schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.school_name}
              </option>
            ))}
          </Select>
          <Input
            label="Search EMIS Code"
            value={emisSearch}
            onChange={(e) => setEmisSearch(e.target.value)}
            placeholder="e.g. 14501"
          />
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

      <Card>
        <p className="mb-3 text-sm font-bold text-brand-900 print:text-black">
          Reports ({filtered.length})
        </p>
        {filtered.length === 0 ? (
          <EmptyState icon="📄" title="No reports match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-gray-500 print:text-black">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">School Name</th>
                  <th className="py-2 pr-2">EMIS Code</th>
                  <th className="py-2 pr-2">Drop Out</th>
                  <th className="py-2 pr-2">Public</th>
                  <th className="py-2 pr-2">Private</th>
                  <th className="py-2 pr-2">Fresh Admission</th>
                  <th className="py-2 pr-2">Total Enrollment</th>
                  <th className="py-2 pr-2">Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const school = schoolById.get(r.school_id);
                  return (
                    <tr key={r.id} className="border-b border-brand-50">
                      <td className="py-2 pr-2">{formatDisplayDate(r.report_date)}</td>
                      <td className="py-2 pr-2 font-medium text-brand-900 print:text-black">
                        {school?.school_name ?? "—"}
                      </td>
                      <td className="py-2 pr-2">{school?.emis_code ?? "—"}</td>
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
        )}
      </Card>
    </div>
  );
}
