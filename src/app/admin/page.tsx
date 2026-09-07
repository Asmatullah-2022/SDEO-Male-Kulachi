import { Suspense } from "react";
import { OFFICIAL_WHATSAPP_GROUP_JOIN_URL } from "@/lib/whatsapp";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { OverviewClient } from "./OverviewClient";

/**
 * Auth + role protection for every /admin/* route is handled once, at the
 * edge, by middleware (src/lib/supabase/middleware.ts) — this page used to
 * repeat that same check (getCurrentUser()) on every navigation, doubling
 * the auth round trips for no benefit. All data fetching now happens
 * client-side through the shared cache in src/lib/adminCache.ts, so this
 * page itself has no server-side data dependency and Next can serve it
 * from the client router cache instantly on repeat visits.
 */
export default function AdminOverviewPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="SDEO Office Dashboard" homeHref="/admin" showProfileLink />
      <AdminNav />

      <div className="mx-auto w-full max-w-5xl px-4 pt-6">
        <a
          href={OFFICIAL_WHATSAPP_GROUP_JOIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebc59]"
        >
          📱 Join Official WhatsApp Group
        </a>
      </div>

      <Suspense fallback={null}>
        <OverviewClient />
      </Suspense>
    </main>
  );
}
