"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";

export interface SchoolOption {
  id: string;
  school_name: string;
  emis_code: string;
}

interface SchoolPickerProps {
  title: string;
  description?: string;
  confirmLabel: string;
  showReasonField?: boolean;
  submitting?: boolean;
  errorMessage?: string | null;
  onConfirm: (school: SchoolOption, reason: string) => void;
  onClose: () => void;
}

/**
 * Mobile-first bottom-sheet school picker, shared by "Select My School"
 * (first assignment) and "Request School Change" on the Profile page.
 * Fetches from the existing /api/register/schools endpoint — same
 * active-and-unassigned school list already used by the registration
 * page, so there is exactly one source of truth for "which schools can a
 * headteacher be assigned to" rather than a second copy of that query.
 */
export function SchoolPicker({
  title,
  description,
  confirmLabel,
  showReasonField = false,
  submitting = false,
  errorMessage,
  onConfirm,
  onClose,
}: SchoolPickerProps) {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SchoolOption | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/register/schools");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load the school list.");
        if (!cancelled) setSchools(json.schools ?? []);
      } catch (err) {
        if (!cancelled) setLoadError((err as Error)?.message ?? "Could not load the school list. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.school_name.toLowerCase().includes(q) || s.emis_code.toLowerCase().includes(q));
  }, [schools, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-brand-100 px-4 py-3.5">
          <p className="text-sm font-bold text-brand-900">{title}</p>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-gray-500 hover:text-brand-700">
            ✕ Close
          </button>
        </div>

        {confirming && selected ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {errorMessage && <Alert type="error">{errorMessage}</Alert>}
            <p className="text-sm text-brand-900">Are you sure you want to select this school?</p>
            <div className="space-y-1 rounded-xl bg-brand-50 p-3 text-sm">
              <p>
                <span className="font-semibold text-brand-900">School:</span> {selected.school_name}
              </p>
              <p>
                <span className="font-semibold text-brand-900">EMIS Code:</span> {selected.emis_code}
              </p>
            </div>
            <p className="text-xs text-gray-500">Once confirmed, the school cannot be changed directly.</p>
            {showReasonField && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-brand-900">Reason for change (optional)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border-2 border-brand-200 px-4 py-3 text-base text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  placeholder="e.g. I was transferred to a different school"
                />
              </div>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" fullWidth loading={submitting} onClick={() => onConfirm(selected, reason)}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-brand-100 px-4 py-3">
              {description && <p className="mb-2 text-xs text-gray-500">{description}</p>}
              <Input placeholder="Search by school name or EMIS code" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {loadError && <Alert type="error">{loadError}</Alert>}
              {loading ? (
                <p className="py-6 text-center text-sm text-gray-500">Loading schools...</p>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No schools match your search.</p>
              ) : (
                <ul className="divide-y divide-brand-50">
                  {filtered.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(s);
                          setConfirming(true);
                        }}
                        className="flex min-h-[44px] w-full items-center justify-between gap-2 py-3 text-left active:bg-brand-50"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-brand-900">{s.school_name}</span>
                          <span className="block text-xs text-gray-500">EMIS: {s.emis_code}</span>
                        </span>
                        <span className="shrink-0 text-brand-600">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
