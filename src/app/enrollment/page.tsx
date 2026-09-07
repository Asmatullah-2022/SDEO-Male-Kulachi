import type { Metadata } from "next";
import Image from "next/image";
import { EnrollmentPortal } from "./EnrollmentPortal";

export const metadata: Metadata = {
  title: "Daily Enrollment Submission Portal | SDEO (Male) Kulachi",
  description: "Submit your school's daily enrollment report to SDEO (Male) Kulachi, District Dera Ismail Khan.",
};

export default function EnrollmentPortalPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image src="/logo.png" alt="SDEO Male Kulachi" width={44} height={44} className="h-full w-full object-contain" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-brand-900">SDEO Male Kulachi</p>
            <p className="text-xs text-gray-600">Daily Enrollment Submission Portal</p>
            <p className="text-[11px] text-gray-400">District Dera Ismail Khan</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <EnrollmentPortal />
      </div>

      <footer className="border-t border-brand-100 bg-white py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Sub-Divisional Education Officer (Male), Kulachi · District Dera Ismail Khan
      </footer>
    </main>
  );
}
