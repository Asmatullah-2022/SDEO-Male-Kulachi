import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { AdminProfileClient } from "./AdminProfileClient";

/**
 * Dedicated Admin Profile page — separate from the headteacher-shared
 * /profile route. Auth + admin-only access is enforced by middleware
 * (ADMIN_ONLY_PREFIXES already matches /admin/*), same pattern as the
 * other admin pages — see src/app/admin/page.tsx.
 */
export default function AdminProfilePage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="My Profile" homeHref="/admin" />
      <AdminNav />
      <AdminProfileClient />
    </main>
  );
}
