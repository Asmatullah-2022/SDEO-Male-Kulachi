import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { SubmitReportForm } from "./SubmitReportForm";

/**
 * Auth/data fetching moved entirely client-side — see the comment in
 * src/app/dashboard/page.tsx for why. This page has no server-side data
 * dependency, so Next serves it from the client router cache instantly.
 */
export default function SubmitReportPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi" subtitle="Daily Enrollment Form" />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <SubmitReportForm />
      </div>
      <BottomNav />
    </main>
  );
}
