import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProfileClient } from "./ProfileClient";

/**
 * Headteacher Profile page, reached via the bottom nav. Admin has its own
 * dedicated profile page at /admin/profile (see src/app/admin/profile) —
 * this route no longer doubles as the admin's profile link.
 * Auth is enforced by middleware (added to PROTECTED_PREFIXES); no
 * server-side data dependency here, same pattern as the other headteacher
 * pages — see src/app/dashboard/page.tsx.
 */
export default function ProfilePage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi" subtitle="My Profile" />
      <ProfileClient />
      <BottomNav />
    </main>
  );
}
