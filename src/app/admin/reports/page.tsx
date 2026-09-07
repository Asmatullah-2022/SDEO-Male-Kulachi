import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { ReportsClient } from "./ReportsClient";

/**
 * Auth/role protection lives entirely in middleware now — see the comment
 * in src/app/admin/page.tsx. Data fetching moved client-side into
 * ReportsClient (src/lib/adminCache.ts), so this page has no server-side
 * data dependency.
 */
export default function AdminReportsPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50 print:bg-white">
      <div className="print:hidden">
        <Header title="SDEO Kulachi Admin" subtitle="Reports & Analytics" homeHref="/admin" showProfileLink />
        <AdminNav />
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <ReportsClient />
      </div>
    </main>
  );
}
