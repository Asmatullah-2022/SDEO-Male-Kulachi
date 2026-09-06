import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { UsersManager } from "./UsersManager";

/**
 * Auth/role protection lives entirely in middleware now — see the comment
 * in src/app/admin/page.tsx. This page has no server-side data dependency;
 * UsersManager fetches from the shared client cache (src/lib/adminCache.ts),
 * reusing the same "schools" cache entry Overview/Schools already populate.
 */
export default function AdminUsersPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="User Management" homeHref="/admin" />
      <AdminNav />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <UsersManager />
      </div>
    </main>
  );
}
