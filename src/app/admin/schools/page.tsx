import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { SchoolsManager } from "./SchoolsManager";

/**
 * Auth/role protection lives entirely in middleware now — see the comment
 * in src/app/admin/page.tsx. This page has no server-side data dependency;
 * SchoolsManager fetches from the shared client cache (src/lib/adminCache.ts).
 */
export default function AdminSchoolsPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="School Management" homeHref="/admin" showProfileLink />
      <AdminNav />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <SchoolsManager />
      </div>
    </main>
  );
}
