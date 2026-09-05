import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { ReportsExplorer } from "./ReportsExplorer";

export default async function AdminReportsPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: reports }, { data: schools }] = await Promise.all([
    supabase.from("daily_enrollment").select("*").order("report_date", { ascending: false }).limit(1000),
    supabase.from("schools").select("*").order("school_name"),
  ]);

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50 print:bg-white">
      <div className="print:hidden">
        <Header title="SDEO Kulachi Admin" subtitle="Reports & Analytics" homeHref="/admin" />
        <AdminNav />
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <ReportsExplorer reports={reports ?? []} schools={schools ?? []} />
      </div>
    </main>
  );
}
