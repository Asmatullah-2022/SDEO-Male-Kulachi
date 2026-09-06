"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { enrollmentSchema } from "@/lib/validation";
import { buildWhatsAppMessage, getReportShareLink } from "@/lib/whatsapp";
import { formatDisplayDate, formatDateTime, todayISO } from "@/lib/date";
import { useAdminCache } from "@/lib/adminCache";
import { fetchMyProfile, fetchMyReports, type MyProfileData } from "@/lib/headteacherCache";
import type { DailyEnrollment } from "@/lib/types";
import { Card } from "@/components/Card";
import { NumberStepper } from "@/components/NumberStepper";
import { Textarea } from "@/components/Textarea";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { Skeleton } from "@/components/Skeleton";

interface FormValues {
  fresh_admission: number;
  public_admission: number;
  private_admission: number;
  dropout: number;
  remarks: string;
}

const emptyValues: FormValues = {
  fresh_admission: 0,
  public_admission: 0,
  private_admission: 0,
  dropout: 0,
  remarks: "",
};

/**
 * Reads the same "myProfile"/"myReports" cache the Home and History tabs
 * share (src/lib/headteacherCache.ts) instead of receiving school/user/
 * existingReport as server-rendered props — that removed the per-navigation
 * Supabase round trip this page used to pay on every tab switch.
 */
export function SubmitReportForm() {
  const router = useRouter();
  const profileCache = useAdminCache<MyProfileData>("myProfile", fetchMyProfile);
  const reportsCache = useAdminCache<DailyEnrollment[]>("myReports", fetchMyReports);

  useEffect(() => {
    if (profileCache.data?.profile.role === "admin") router.replace("/admin");
  }, [profileCache.data, router]);

  const today = todayISO();
  const existingReport = useMemo(
    () => reportsCache.data?.find((r) => r.report_date === today) ?? null,
    [reportsCache.data, today]
  );

  const [values, setValues] = useState<FormValues>(emptyValues);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedReport, setSavedReport] = useState<DailyEnrollment | null>(null);

  // Pre-fill the form from the cached existing report exactly once it
  // becomes available, without clobbering the headteacher's in-progress
  // edits on every re-render (cache resolves asynchronously). Adjusting
  // state during render, rather than in an effect, is the pattern React
  // recommends for this — it avoids an extra commit-then-immediately-
  // re-render cycle. See https://react.dev/learn/you-might-not-need-an-effect
  if (reportsCache.data && initializedFor !== today) {
    setInitializedFor(today);
    setValues(
      existingReport
        ? {
            fresh_admission: existingReport.fresh_admission,
            public_admission: existingReport.public_admission,
            private_admission: existingReport.private_admission,
            dropout: existingReport.dropout,
            remarks: existingReport.remarks ?? "",
          }
        : emptyValues
    );
  }

  const total = values.fresh_admission + values.public_admission + values.private_admission + values.dropout;

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Guards against a double-tap firing two overlapping submits before the
    // button's disabled state has painted — common on mobile touchscreens.
    if (submitting) return;
    setServerError(null);

    const result = enrollmentSchema.safeParse(values);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        errs[String(issue.path[0])] = issue.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});

    const school = profileCache.data?.school;
    const profile = profileCache.data?.profile;
    if (!school || !profile) return;

    setSubmitting(true);

    const supabase = createClient();
    const totalEnrollment =
      result.data.fresh_admission + result.data.public_admission + result.data.private_admission + result.data.dropout;
    const payload = {
      school_id: school.id,
      user_id: profile.id,
      report_date: today,
      dropout: result.data.dropout,
      public_admission: result.data.public_admission,
      private_admission: result.data.private_admission,
      fresh_admission: result.data.fresh_admission,
      total_enrollment: totalEnrollment,
      remarks: result.data.remarks ? result.data.remarks : null,
    };

    const { data, error } = await supabase
      .from("daily_enrollment")
      .upsert(payload, { onConflict: "school_id,report_date" })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setServerError(
        error.code === "23505"
          ? "A report for this school has already been submitted today."
          : "Something went wrong while saving your report. Please try again."
      );
      return;
    }

    const saved = data as DailyEnrollment;
    setSavedReport(saved);
    // Update the shared cache directly so Home/History reflect this
    // submission immediately, with no refetch needed on the next tab switch.
    reportsCache.mutate((prev) => {
      const others = (prev ?? []).filter((r) => r.id !== saved.id);
      return [saved, ...others].sort((a, b) => b.report_date.localeCompare(a.report_date));
    });
  }

  const loadError = profileCache.error || reportsCache.error;
  if (loadError) {
    return <Alert type="error">{loadError}</Alert>;
  }

  const loading = (profileCache.loading && !profileCache.data) || (reportsCache.loading && !reportsCache.data);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!profileCache.data?.school) {
    return (
      <Alert type="warning">
        Your account is not yet assigned to a school. Please contact the SDEO (Male) Kulachi office.
      </Alert>
    );
  }

  const { school, profile } = profileCache.data;
  const headteacherName = profile.full_name;

  if (savedReport) {
    const message = buildWhatsAppMessage(savedReport, school, headteacherName);
    const link = getReportShareLink(message);

    return (
      <div className="flex flex-col gap-4">
        <Alert type="success">
          {existingReport ? "Report updated successfully." : "Daily enrollment submitted successfully."}
        </Alert>

        <Card>
          <p className="text-sm font-bold text-brand-900">Submission Summary</p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Date" value={formatDisplayDate(savedReport.report_date)} />
            <Row label="School Name" value={school.school_name} />
            <Row label="EMIS Code" value={school.emis_code} />
            <Row label="Headteacher" value={headteacherName} />
            <Row label="Fresh Admission" value={savedReport.fresh_admission} />
            <Row label="Public Admission" value={savedReport.public_admission} />
            <Row label="Private Admission" value={savedReport.private_admission} />
            <Row label="Drop Out" value={savedReport.dropout} />
            <Row label="Total Enrollment" value={savedReport.total_enrollment} bold />
            {savedReport.remarks && <Row label="Remarks" value={savedReport.remarks} />}
            <Row label="Submitted At" value={formatDateTime(savedReport.submitted_at)} />
          </dl>
        </Card>

        <a href={link} target="_blank" rel="noopener noreferrer">
          <Button fullWidth className="bg-[#25D366] hover:bg-[#1ebc59]">
            💬 Share Report to SDEO Group
          </Button>
        </a>

        <Button variant="outline" fullWidth onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {serverError && <Alert type="error">{serverError}</Alert>}
      {existingReport && (
        <Alert type="info">
          You already submitted today&apos;s report. You can update the figures below — edits are only
          allowed on the same day the report was submitted.
        </Alert>
      )}

      <Card className="space-y-3">
        <p className="text-sm font-bold text-brand-900">Daily Enrollment Data</p>
        <Row label="Date" value={formatDisplayDate(today)} />
        <Row label="School Name" value={school.school_name} />
        <Row label="EMIS Code" value={school.emis_code} />
        <Row label="Headteacher Name" value={headteacherName} />
      </Card>

      <Card className="space-y-4">
        <NumberStepper
          label="Fresh Admissions"
          value={values.fresh_admission}
          onChange={(v) => updateField("fresh_admission", v)}
        />
        {errors.fresh_admission && <p className="text-xs font-medium text-red-600">{errors.fresh_admission}</p>}

        <NumberStepper
          label="Public Admissions"
          value={values.public_admission}
          onChange={(v) => updateField("public_admission", v)}
        />
        {errors.public_admission && <p className="text-xs font-medium text-red-600">{errors.public_admission}</p>}

        <NumberStepper
          label="Private Admissions"
          value={values.private_admission}
          onChange={(v) => updateField("private_admission", v)}
        />
        {errors.private_admission && <p className="text-xs font-medium text-red-600">{errors.private_admission}</p>}

        <NumberStepper label="Dropouts" value={values.dropout} onChange={(v) => updateField("dropout", v)} />
        {errors.dropout && <p className="text-xs font-medium text-red-600">{errors.dropout}</p>}

        <div className="rounded-xl bg-brand-50 p-4 text-center">
          <p className="text-sm font-semibold text-brand-800">Total Enrollment (calculated automatically)</p>
          <p className="text-3xl font-bold text-brand-900">{total}</p>
        </div>

        <Textarea
          label="Remarks (optional)"
          placeholder="Any additional notes about today's enrollment..."
          value={values.remarks}
          onChange={(e) => updateField("remarks", e.target.value)}
          error={errors.remarks}
        />
      </Card>

      <Button type="submit" fullWidth loading={submitting}>
        {existingReport ? "Update Submission" : "Submit"}
      </Button>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-brand-100 pb-1.5 last:border-0 last:pb-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right ${bold ? "font-bold text-brand-800" : "font-semibold text-brand-900"}`}>{value}</dd>
    </div>
  );
}
