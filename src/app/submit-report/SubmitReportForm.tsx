"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { enrollmentSchema } from "@/lib/validation";
import { buildWhatsAppDeepLink, buildWhatsAppMessage } from "@/lib/whatsapp";
import { formatDisplayDate } from "@/lib/date";
import type { DailyEnrollment, School } from "@/lib/types";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";

interface Props {
  school: School;
  userId: string;
  today: string;
  existingReport: DailyEnrollment | null;
}

const FIELDS = [
  { key: "dropout" as const, label: "Drop Out" },
  { key: "public_admission" as const, label: "Public" },
  { key: "private_admission" as const, label: "Private" },
  { key: "fresh_admission" as const, label: "Fresh Admission" },
  { key: "total_enrollment" as const, label: "Total Enrollment" },
];

export function SubmitReportForm({ school, userId, today, existingReport }: Props) {
  const router = useRouter();
  const [values, setValues] = useState({
    dropout: existingReport ? String(existingReport.dropout) : "",
    public_admission: existingReport ? String(existingReport.public_admission) : "",
    private_admission: existingReport ? String(existingReport.private_admission) : "",
    fresh_admission: existingReport ? String(existingReport.fresh_admission) : "",
    total_enrollment: existingReport ? String(existingReport.total_enrollment) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedReport, setSavedReport] = useState<DailyEnrollment | null>(existingReport);

  function handleChange(key: keyof typeof values, raw: string) {
    if (raw !== "" && !/^\d*$/.test(raw)) return;
    setValues((v) => ({ ...v, [key]: raw }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
    setSubmitting(true);

    const supabase = createClient();
    const payload = {
      school_id: school.id,
      user_id: userId,
      report_date: today,
      ...result.data,
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

    setSavedReport(data as DailyEnrollment);
  }

  if (savedReport) {
    const message = buildWhatsAppMessage(savedReport, school);
    const link = buildWhatsAppDeepLink(message);

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
            <Row label="Drop Out" value={savedReport.dropout} />
            <Row label="Public" value={savedReport.public_admission} />
            <Row label="Private" value={savedReport.private_admission} />
            <Row label="Fresh Admission" value={savedReport.fresh_admission} />
            <Row label="Total Enrollment" value={savedReport.total_enrollment} bold />
          </dl>
        </Card>

        <a href={link} target="_blank" rel="noopener noreferrer">
          <Button fullWidth className="bg-[#25D366] hover:bg-[#1ebc59]">
            💬 Send to Official WhatsApp
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
        <Alert type="info">You already submitted a report today — you can update the figures below.</Alert>
      )}

      <Card className="space-y-3">
        <p className="text-sm font-bold text-brand-900">Daily Enrollment Data</p>
        <Row label="Date" value={formatDisplayDate(today)} />
        <Row label="School Name" value={school.school_name} />
        <Row label="EMIS Code" value={school.emis_code} />
      </Card>

      <Card className="space-y-4">
        {FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            name={f.key}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={values[f.key]}
            onChange={(e) => handleChange(f.key, e.target.value)}
            error={errors[f.key]}
          />
        ))}
      </Card>

      <Button type="submit" fullWidth loading={submitting}>
        {existingReport ? "Update Submission" : "Submit"}
      </Button>
    </form>
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
