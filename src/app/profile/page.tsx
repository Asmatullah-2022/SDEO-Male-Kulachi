import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProfileClient } from "./ProfileClient";

/**
 * Shared by both roles: a headteacher reaches it via the bottom nav, an
 * admin via the header profile link (admin pages have no bottom nav).
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
