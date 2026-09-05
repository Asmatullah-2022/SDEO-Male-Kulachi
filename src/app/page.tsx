import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

const features = [
  { icon: "📝", title: "Daily Enrollment Form", desc: "Submit dropout, admission and total enrollment figures in under a minute." },
  { icon: "✅", title: "One Report Per Day", desc: "The system automatically prevents duplicate submissions for the same day." },
  { icon: "💬", title: "WhatsApp Integration", desc: "Send a ready-made summary straight to the official SDEO WhatsApp number." },
  { icon: "📊", title: "Live Monitoring", desc: "SDEO office tracks submitted and pending schools in real time." },
];

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <header className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-2xl text-white shadow-md">
          🎓
        </span>
        <div>
          <p className="text-sm font-bold text-brand-900">SDEO (Male) Kulachi</p>
          <p className="text-xs text-gray-600">Daily Enrollment Monitoring System</p>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 pb-16 pt-6 text-center">
        <h1 className="text-2xl font-extrabold leading-tight text-brand-900 sm:text-3xl">
          Daily Enrollment Monitoring for
          <br />
          Government Primary Schools
        </h1>
        <p className="mt-3 max-w-xl text-sm text-gray-700 sm:text-base">
          A simple, mobile-friendly system for Headteachers/Incharges under the Sub-Divisional Education
          Officer (Male), Kulachi, District Dera Ismail Khan, to submit and track daily enrollment data.
        </p>

        <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
          <Link href="/login" className="w-full">
            <Button fullWidth>Headteacher Login</Button>
          </Link>
        </div>

        <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <Card key={f.title} className="flex items-start gap-3 text-left">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="text-sm font-bold text-brand-900">{f.title}</p>
                <p className="text-xs text-gray-600">{f.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-brand-100 bg-white py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Sub-Divisional Education Officer (Male), Kulachi · District Dera Ismail Khan · Khyber Pakhtunkhwa
      </footer>
    </main>
  );
}
