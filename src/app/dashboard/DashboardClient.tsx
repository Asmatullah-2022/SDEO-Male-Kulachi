"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAdminCache } from "@/lib/adminCache";
import { fetchMyProfile, fetchMyReports, type MyProfileData } from "@/lib/headteacherCache";
import { todayISO, formatDisplayDate, formatDateTime } from "@/lib/date";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { StatCard } from "@/components/StatCard";
import { Skeleton, StatGridSkeleton } from "@/components/Skeleton";
import type { DailyEnrollment } from "@/lib/types";

/**
 * Client-driven Home tab. Reads the shared "myProfile"/"myReports" cache
 * (see src/lib/headteacherCache.ts) instead of each page doing its own
 * server-side auth + Supabase fetch on every navigation — that duplicate
 * work (on top of middleware's own auth check) was the actual cause of
 * the slow tab switching this replaces.
 */
export function DashboardClient() {
  const router = useRouter();
  const profileCache = useAdminCache<MyProfileData>("myProfile", fetchMyProfile);
  const reportsCache = useAdminCache<DailyEnrollment[]>("myReports", fetchMyReports);

  useEffect(() => {
    if (profileCache.data?.profile.role === "admin") router.replace("/admin");
  }, [profileCache.data, router]);

  const loading =
    (profileCache.loading && !profileCache.data) || (reportsCache.loading && !reportsCache.data);

  const derived = useMemo(() => {
    if (!reportsCache.data) return null;
    const today = todayISO();
    const monthStart = today.slice(0, 7);
    const todaysReport = reportsCache.data.find((r) => r.report_date === today) ?? null;
    const monthlyCount = reportsCache.data.filter((r) => r.report_date.startsWith(monthStart)).length;
    const latestReport = reportsCache.data[0] ?? null; // already ordered by report_date desc
    return { today, todaysReport, monthlyCount, latestReport };
  }, [reportsCache.data]);

  const loadError = profileCache.error || reportsCache.error;
  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Alert type="error">{loadError}</Alert>
      </div>
    );
  }

  if (loading || !derived) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
        <StatGridSkeleton />
      </div>
    );
  }

  if (!profileCache.data?.school) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Alert type="warning">
          Your account is not yet assigned to a school. Please contact the SDEO (Male) Kulachi office.
        </Alert>
      </div>
    );
  }

  const { profile, school, email } = profileCache.data;
  const { todaysReport: report, monthlyCount, latestReport } = derived;
  const submitted = Boolean(report);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
      {/* User information */}
      <Card>
        <p className="text-sm text-gray-500">Welcome,</p>
        <p className="text-lg font-bold text-brand-900">{profile.full_name}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-gray-500">Email</p>
            <p className="break-all font-semibold text-brand-900">{email ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Mobile Number</p>
            <p className="font-semibold text-brand-900">{profile.mobile_number ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">School Name</p>
            <p className="font-semibold text-brand-900">{school.school_name}</p>
          </div>
          <div>
            <p className="text-gray-500">EMIS Code</p>
            <p className="font-semibold text-brand-900">{school.emis_code}</p>
          </div>
        </div>
      </Card>

      {/* Report submission status */}
      <Card className={submitted ? "bg-brand-50" : "bg-amber-50"}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Today&apos;s Report Status</p>
            <p className={`text-lg font-bold ${submitted ? "text-brand-700" : "text-amber-700"}`}>
              {submitted ? "✅ Submitted" : "⏳ Pending"}
            </p>
          </div>
          <span className="text-3xl">{submitted ? "✅" : "⏳"}</span>
        </div>
        {latestReport && (
          <div className="mt-3 border-t border-dashed border-brand-100 pt-3 text-xs text-gray-500">
            <p>Last Submitted Date: {formatDisplayDate(latestReport.report_date)}</p>
            <p>Last Submission Time: {formatDateTime(latestReport.submitted_at)}</p>
          </div>
        )}
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard label="Fresh Admissions" value={report?.fresh_admission ?? 0} tone="blue" icon="🆕" />
        <StatCard label="Public Admissions" value={report?.public_admission ?? 0} tone="blue" icon="🏛️" />
        <StatCard label="Private Admissions" value={report?.private_admission ?? 0} tone="blue" icon="🏢" />
        <StatCard label="Dropouts" value={report?.dropout ?? 0} tone="red" icon="📉" />
        <StatCard label="Total Enrollment" value={report?.total_enrollment ?? 0} tone="brand" icon="📚" />
        <StatCard label="Monthly Reports Submitted" value={monthlyCount} icon="🗓️" />
      </div>

      <div className="flex flex-col gap-3">
        {!submitted ? (
          <Link href="/submit-report">
            <Button fullWidth>📝 Submit Daily Enrollment</Button>
          </Link>
        ) : (
          <Link href="/submit-report">
            <Button fullWidth variant="secondary">
              ✏️ Update Today&apos;s Submission
            </Button>
          </Link>
        )}
        <Link href="/history">
          <Button fullWidth variant="outline">
            📊 View Submission History
          </Button>
        </Link>
        <a href="/dashboard#contact">
          <Button fullWidth variant="ghost">
            ☎️ Contact SDEO Office
          </Button>
        </a>
      </div>

      <Card id="contact">
        <p className="text-sm font-bold text-brand-900">Contact SDEO (Male) Kulachi</p>
        <p className="mt-1 text-sm text-gray-600">
          For any issues with login, school assignment, or data corrections, please contact the SDEO
          office directly through the official WhatsApp number provided by your office.
        </p>
      </Card>
    </div>
  );
}
