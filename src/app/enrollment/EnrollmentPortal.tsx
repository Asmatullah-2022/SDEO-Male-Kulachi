"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { NumberStepper } from "@/components/NumberStepper";
import { todayISO, formatDisplayDate } from "@/lib/date";
import { OFFICIAL_WHATSAPP_GROUP_JOIN_URL } from "@/lib/whatsapp";

interface SchoolListItem {
  id: string;
  school_name: string;
  emis_code: string;
}

interface SchoolLookup {
  schoolId: string;
  schoolName: string;
  emisCode: string;
  headteacherName: string | null;
  hasHeadteacher: boolean;
  reportDate: string;
  existing: {
    dropout: number;
    public_admission: number;
    private_admission: number;
    fresh_admission: number;
    total_enrollment: number;
    submitted_at: string;
  } | null;
}

interface FormValues {
  dropout: number;
  public_admission: number;
  private_admission: number;
  fresh_admission: number;
}

interface SubmitResult {
  schoolName: string;
  emisCode: string;
  headteacherName: string;
  report: {
    report_date: string;
    dropout: number;
    public_admission: number;
    private_admission: number;
    fresh_admission: number;
    total_enrollment: number;
  };
}

type Step = "search" | "form" | "success";

const emptyForm: FormValues = { dropout: 0, public_admission: 0, private_admission: 0, fresh_admission: 0 };

export function EnrollmentPortal() {
  const [step, setStep] = useState<Step>("search");

  const [schools, setSchools] = useState<SchoolListItem[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<SchoolLookup | null>(null);

  const [form, setForm] = useState<FormValues>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SubmitResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSchools() {
      setSchoolsLoading(true);
      setSchoolsError(null);
      try {
        const res = await fetch("/api/enrollment/schools");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load the school list.");
        if (!cancelled) setSchools(json.schools as SchoolListItem[]);
      } catch (err) {
        if (!cancelled) {
          setSchoolsError((err as Error)?.message ?? "Could not load the school list. Please try again.");
        }
      } finally {
        if (!cancelled) setSchoolsLoading(false);
      }
    }
    loadSchools();
    return () => {
      cancelled = true;
    };
  }, []);

  const query = search.trim().toLowerCase();
  const filteredSchools = useMemo(
    () =>
      query
        ? schools.filter(
            (s) => s.school_name.toLowerCase().includes(query) || s.emis_code.toLowerCase().includes(query)
          )
        : schools,
    [schools, query]
  );

  async function handleSelectSchool(emisCode: string) {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/enrollment/school?emis_code=${encodeURIComponent(emisCode)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not find that school.");

      const info = json as SchoolLookup;
      setSchoolInfo(info);
      setForm(
        info.existing
          ? {
              dropout: info.existing.dropout,
              public_admission: info.existing.public_admission,
              private_admission: info.existing.private_admission,
              fresh_admission: info.existing.fresh_admission,
            }
          : emptyForm
      );
      setSubmitError(null);
      setStep("form");
    } catch (err) {
      setLookupError((err as Error)?.message ?? "Could not find that school. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  }

  function handleChangeSchool() {
    setStep("search");
    setSchoolInfo(null);
    setForm(emptyForm);
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (!schoolInfo) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/enrollment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emis_code: schoolInfo.emisCode, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      setSuccessData(json as SubmitResult);
      setStep("success");
    } catch (err) {
      setSubmitError((err as Error)?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitAnother() {
    setStep("search");
    setSchoolInfo(null);
    setForm(emptyForm);
    setSuccessData(null);
    setSubmitError(null);
    setSearch("");
  }

  const total = form.dropout + form.public_admission + form.private_admission + form.fresh_admission;

  return (
    <div className="space-y-6">
      {step === "search" && (
        <Card>
          <p className="mb-1 text-base font-bold text-brand-900">Step 1: Find Your School</p>
          <p className="mb-3 text-sm text-gray-500">Enter your EMIS Code or search by school name.</p>

          <Input
            placeholder="EMIS Code or School Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-base"
            autoFocus
          />

          {lookupError && (
            <div className="mt-3">
              <Alert type="error">{lookupError}</Alert>
            </div>
          )}

          <div className="mt-4">
            {schoolsLoading ? (
              <Spinner label="Loading schools..." />
            ) : schoolsError ? (
              <Alert type="error">{schoolsError}</Alert>
            ) : filteredSchools.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No schools found"
                description="Check the spelling or EMIS code and try again."
              />
            ) : (
              <div className="max-h-80 divide-y divide-brand-50 overflow-y-auto rounded-xl border border-brand-100">
                {filteredSchools.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={lookupLoading}
                    onClick={() => handleSelectSchool(s.emis_code)}
                    className="flex w-full min-h-[56px] items-center justify-between gap-2 px-4 py-3 text-left hover:bg-brand-50 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-brand-900">{s.school_name}</span>
                      <span className="block text-xs text-gray-500">EMIS: {s.emis_code}</span>
                    </span>
                    <span className="shrink-0 text-brand-400">→</span>
                  </button>
                ))}
              </div>
            )}
            {lookupLoading && (
              <div className="mt-3">
                <Spinner label="Looking up school..." />
              </div>
            )}
          </div>
        </Card>
      )}

      {step === "form" && schoolInfo && (
        <div className="space-y-4">
          <Card className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-brand-900">{schoolInfo.schoolName}</p>
                <p className="text-sm text-gray-500">EMIS Code: {schoolInfo.emisCode}</p>
                <p className="text-sm text-gray-500">
                  Head Teacher: {schoolInfo.headteacherName ?? "Not assigned"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleChangeSchool}
                className="shrink-0 text-xs font-semibold text-brand-700 underline underline-offset-2"
              >
                Change School
              </button>
            </div>
          </Card>

          {!schoolInfo.hasHeadteacher && (
            <Alert type="error">
              This school has no assigned headteacher account yet, so an online submission can&apos;t be
              recorded. Please contact the SDEO (Male) Kulachi office.
            </Alert>
          )}

          {schoolInfo.existing && (
            <Alert type="warning">
              You have already submitted today&apos;s enrollment. You can update the figures below and submit
              again.
            </Alert>
          )}

          {submitError && <Alert type="error">{submitError}</Alert>}

          <Card className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-brand-900">Date</p>
              <p className="text-lg font-bold text-brand-800">{formatDisplayDate(todayISO())}</p>
            </div>

            <NumberStepper
              label="Drop Out"
              value={form.dropout}
              onChange={(v) => setForm((f) => ({ ...f, dropout: v }))}
            />
            <NumberStepper
              label="Public"
              value={form.public_admission}
              onChange={(v) => setForm((f) => ({ ...f, public_admission: v }))}
            />
            <NumberStepper
              label="Private"
              value={form.private_admission}
              onChange={(v) => setForm((f) => ({ ...f, private_admission: v }))}
            />
            <NumberStepper
              label="Fresh Admission"
              value={form.fresh_admission}
              onChange={(v) => setForm((f) => ({ ...f, fresh_admission: v }))}
            />

            <div className="rounded-xl bg-brand-50 p-4 text-center">
              <p className="text-sm font-semibold text-brand-800">Total Enrollment</p>
              <p className="text-3xl font-bold text-brand-900">{total}</p>
            </div>
          </Card>

          <Button
            fullWidth
            loading={submitting}
            disabled={!schoolInfo.hasHeadteacher}
            onClick={handleSubmit}
            className="bg-[#25D366] hover:bg-[#1ebc59]"
          >
            {schoolInfo.existing ? "✓ Update Today's Enrollment" : "✓ Submit Today's Enrollment"}
          </Button>
        </div>
      )}

      {step === "success" && successData && (
        <div className="space-y-4">
          <Alert type="success">Enrollment Submitted Successfully</Alert>
          <Card>
            <dl className="space-y-2 text-sm">
              <Row label="School Name" value={successData.schoolName} />
              <Row label="EMIS Code" value={successData.emisCode} />
              <Row label="Date" value={formatDisplayDate(successData.report.report_date)} />
              <Row label="Drop Out" value={successData.report.dropout} />
              <Row label="Public" value={successData.report.public_admission} />
              <Row label="Private" value={successData.report.private_admission} />
              <Row label="Fresh Admission" value={successData.report.fresh_admission} />
              <Row label="Total Enrollment" value={successData.report.total_enrollment} bold />
            </dl>
          </Card>
          <Button fullWidth variant="outline" onClick={handleSubmitAnother}>
            Submit Another School
          </Button>
        </div>
      )}

      <Card>
        <p className="text-sm font-bold text-brand-900">📢 Official Communication</p>
        <p className="mt-1 text-sm text-gray-600">
          Join the SDEO Male Kulachi WhatsApp Group for official announcements and instructions.
        </p>
        <a
          href={OFFICIAL_WHATSAPP_GROUP_JOIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block"
        >
          <Button fullWidth className="bg-[#25D366] hover:bg-[#1ebc59]">
            📱 Join Official WhatsApp Group
          </Button>
        </a>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-brand-100 pb-1.5 last:border-0 last:pb-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className={bold ? "font-bold text-brand-800" : "font-semibold text-brand-900"}>{value}</dd>
    </div>
  );
}
