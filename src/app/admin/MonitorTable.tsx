"use client";

import { useState } from "react";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";

export interface MonitorRow {
  schoolId: string;
  schoolName: string;
  emisCode: string;
  headteacherName: string | null;
  submitted: boolean;
  dropout: number;
  publicAdmission: number;
  privateAdmission: number;
  freshAdmission: number;
  totalEnrollment: number;
}

export function MonitorTable({ rows }: { rows: MonitorRow[] }) {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = query
    ? rows.filter(
        (r) => r.schoolName.toLowerCase().includes(query) || r.emisCode.toLowerCase().includes(query)
      )
    : rows;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search by School Name or EMIS Code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="No schools match your search" />
      ) : (
        <>
          {/* Mobile card list — avoids horizontal scrolling on small screens */}
          <div className="divide-y divide-brand-50 sm:hidden">
            {filtered.map((r) => (
              <div key={r.schoolId} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-900">{r.schoolName}</p>
                    <p className="text-xs text-gray-500">EMIS: {r.emisCode}</p>
                    <p className="text-xs text-gray-500">{r.headteacherName ?? "Not assigned"}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.submitted ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.submitted ? "✅ Submitted" : "❌ Not Submitted"}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                  <MobileStat label="Drop Out" value={r.submitted ? r.dropout : "—"} />
                  <MobileStat label="Public" value={r.submitted ? r.publicAdmission : "—"} />
                  <MobileStat label="Private" value={r.submitted ? r.privateAdmission : "—"} />
                  <MobileStat label="Fresh" value={r.submitted ? r.freshAdmission : "—"} />
                </dl>
                {r.submitted && (
                  <p className="mt-1 text-right text-xs font-semibold text-brand-800">
                    Total Enrollment: {r.totalEnrollment}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop/tablet table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-gray-500">
                  <th className="py-2 pr-2">School Name</th>
                  <th className="py-2 pr-2">EMIS Code</th>
                  <th className="py-2 pr-2">Headteacher</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Drop Out</th>
                  <th className="py-2 pr-2">Public</th>
                  <th className="py-2 pr-2">Private</th>
                  <th className="py-2 pr-2">Fresh</th>
                  <th className="py-2 pr-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.schoolId} className="border-b border-brand-50">
                    <td className="py-2 pr-2 font-medium text-brand-900">{r.schoolName}</td>
                    <td className="py-2 pr-2 text-gray-600">{r.emisCode}</td>
                    <td className="py-2 pr-2 text-gray-600">{r.headteacherName ?? "Not assigned"}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.submitted ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.submitted ? "✅ Submitted" : "❌ Not Submitted"}
                      </span>
                    </td>
                    <td className="py-2 pr-2">{r.submitted ? r.dropout : "—"}</td>
                    <td className="py-2 pr-2">{r.submitted ? r.publicAdmission : "—"}</td>
                    <td className="py-2 pr-2">{r.submitted ? r.privateAdmission : "—"}</td>
                    <td className="py-2 pr-2">{r.submitted ? r.freshAdmission : "—"}</td>
                    <td className="py-2 pr-2 font-semibold">{r.submitted ? r.totalEnrollment : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-brand-50 p-1.5">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-xs font-bold text-brand-900">{value}</p>
    </div>
  );
}
