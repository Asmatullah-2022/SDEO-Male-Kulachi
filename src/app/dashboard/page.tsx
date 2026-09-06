import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";

export default async function DashboardPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role === "admin") redirect("/admin");
  if (!current.school) {
    return (
      <main className="flex min-h-dvh flex-col bg-brand-50">
        <Header title="SDEO Kulachi" subtitle="Headteacher Dashboard" />
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <Alert type="warning">
            Your account is not yet assigned to a school. Please contact the SDEO (Male) Kulachi office.
          </Alert>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: todaysReport } = await supabase
    .from("daily_enrollment")
    .select("id, submitted_at")
    .eq("school_id", current.school.id)
    .eq("report_date", todayISO())
    .maybeSingle();

  const submitted = Boolean(todaysReport);

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi" subtitle="Headteacher Dashboard" />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <Card>
          <p className="text-sm text-gray-500">Welcome,</p>
          <p className="text-lg font-bold text-brand-900">{current.profile.full_name}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-gray-500">School Name</p>
              <p className="font-semibold text-brand-900">{current.school.school_name}</p>
            </div>
            <div>
              <p className="text-gray-500">EMIS Code</p>
              <p className="font-semibold text-brand-900">{current.school.emis_code}</p>
            </div>
          </div>
        </Card>

        <Card className={submitted ? "bg-brand-50" : "bg-amber-50"}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today&apos;s Submission Status</p>
              <p className={`text-lg font-bold ${submitted ? "text-brand-700" : "text-amber-700"}`}>
                {submitted ? "✅ Submitted" : "⏳ Not Submitted"}
              </p>
            </div>
            <span className="text-3xl">{submitted ? "✅" : "⏳"}</span>
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          {!submitted ? (
            <Link href="/submit-report">
              <Button fullWidth>📝 Submit Daily Enrollment</Button>
            </Link>
          ) : (
            <Link href="/history">
              <Button fullWidth variant="secondary">✅ View Today&apos;s Submission</Button>
            </Link>
          )}
          <Link href="/history">
            <Button fullWidth variant="outline">📊 View Submission History</Button>
          </Link>
          <a href="/dashboard#contact">
            <Button fullWidth variant="ghost">☎️ Contact SDEO Office</Button>
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

      <BottomNav />
    </main>
  );
}
