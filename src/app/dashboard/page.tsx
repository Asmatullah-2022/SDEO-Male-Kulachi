import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { DashboardClient } from "./DashboardClient";

/**
 * Auth is enforced by middleware for every /dashboard, /submit-report, and
 * /history request — this page used to repeat that same check server-side
 * (getCurrentUser()) on every navigation, on top of its own Supabase
 * queries. All data now loads client-side through the shared cache in
 * src/lib/headteacherCache.ts, so this page has no server-side data
 * dependency and Next can serve it from the client router cache instantly
 * on repeat visits — see src/app/admin/page.tsx for the same pattern
 * already proven on the Admin Dashboard.
 */
export default function DashboardPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi" subtitle="Headteacher Dashboard" />
      <DashboardClient />
      <BottomNav />
    </main>
  );
}
