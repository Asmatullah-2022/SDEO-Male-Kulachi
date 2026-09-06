"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DailyEnrollment } from "@/lib/types";
import { formatDateTime, formatDisplayDate } from "@/lib/date";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";

interface Props {
  reports: DailyEnrollment[];
  today: string;
}

const PAGE_SIZE = 10;

export function HistoryExplorer({ reports, today }: Props) {
  const [dateFilter, setDateFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (dateFilter && r.report_date !== dateFilter) return false;
      if (monthFilter && !r.report_date.startsWith(monthFilter)) return false;
      if (query) {
        const inDate = formatDisplayDate(r.report_date).toLowerCase().includes(query);
        const inRemarks = (r.remarks ?? "").toLowerCase().includes(query);
        if (!inDate && !inRemarks) return false;
      }
      return true;
    });
  }, [reports, dateFilter, monthFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetFilters() {
    setDateFilter("");
    setMonthFilter("");
    setSearch("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-3 text-sm font-bold text-brand-900">Filters</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Exact Date"
            type="date"
            value={dateFilter}
            max={today}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Month"
            type="month"
            value={monthFilter}
            max={today.slice(0, 7)}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Search Remarks or Date"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. exam day"
          />
        </div>
        {(dateFilter || monthFilter || search) && (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 text-xs font-semibold text-brand-700 underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No submissions found"
          description="Try adjusting your filters, or your submitted daily enrollment reports will appear here."
        />
      ) : (
        <>
          <div className="space-y-3">
            {pageItems.map((r) => {
              const isToday = r.report_date === today;
              return (
                <Card key={r.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-brand-900">{formatDisplayDate(r.report_date)}</p>
                        {isToday && (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                            Today · Editable
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Submitted: {formatDateTime(r.submitted_at)}</p>
                    </div>
                    {isToday && (
                      <Link href="/submit-report" className="shrink-0 text-xs font-semibold text-brand-700 underline">
                        Edit
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-5">
                    <Metric label="Fresh" value={r.fresh_admission} />
                    <Metric label="Public" value={r.public_admission} />
                    <Metric label="Private" value={r.private_admission} />
                    <Metric label="Drop Out" value={r.dropout} />
                    <Metric label="Total" value={r.total_enrollment} highlight />
                  </div>
                  {r.remarks && <p className="text-xs text-gray-500">📝 {r.remarks}</p>}
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                className="px-3 py-2 text-sm"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </Button>
              <p className="text-xs text-gray-500">
                Page {currentPage} of {totalPages}
              </p>
              <Button
                type="button"
                variant="outline"
                className="px-3 py-2 text-sm"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
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
