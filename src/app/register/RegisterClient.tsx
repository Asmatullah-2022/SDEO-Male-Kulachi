"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { registrationSchema } from "@/lib/validation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PasswordInput } from "@/components/PasswordInput";
import { Select } from "@/components/Select";
import { Alert } from "@/components/Alert";

interface AvailableSchool {
  id: string;
  school_name: string;
  emis_code: string;
}

const emptyForm = {
  full_name: "",
  email: "",
  mobile_number: "",
  school_id: "",
  password: "",
  confirm_password: "",
};

/**
 * Public Headteacher self-registration form. Reuses the exact same
 * architecture as the rest of the app instead of a parallel one:
 *  - The school list comes from /api/register/schools (service-role,
 *    same pattern as /api/enrollment/schools), pre-filtered to schools
 *    with no headteacher yet — TASK 3's one-headteacher-per-school rule.
 *  - Account creation calls supabase.auth.signUp() directly (the anon
 *    client, same one src/app/login/page.tsx uses for sign-in) rather
 *    than a server route, because signUp() is the only Supabase call that
 *    both respects the project's real "Confirm email" setting AND sends
 *    the confirmation email itself when that setting is on.
 *  - full_name/mobile_number/school_id ride along as signUp's user
 *    metadata; the handle_new_user trigger (supabase/schema.sql) picks
 *    them up and inserts the profiles row in the same transaction as the
 *    auth user, always as role "headteacher" — role is never read from
 *    this metadata, so this form has no way to create an admin account,
 *    and there is no role field here for the same reason.
 */
export function RegisterClient() {
  const router = useRouter();
  const [schools, setSchools] = useState<AvailableSchool[]>([]);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [schoolsLoading, setSchoolsLoading] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/register/schools");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load the school list.");
        if (!cancelled) setSchools(json.schools ?? []);
      } catch (err) {
        if (!cancelled) {
          setSchoolsError((err as Error)?.message ?? "Could not load the school list. Please try again.");
        }
      } finally {
        if (!cancelled) setSchoolsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSchool = schools.find((s) => s.id === form.school_id) ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (submitting) return; // blocks a double-tap/double-submit from firing two signUp calls at once

    const result = registrationSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        errs[String(issue.path[0])] = issue.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      // Best-effort duplicate-mobile check (see /api/register/check-mobile) —
      // fails open on its own errors so a hiccup here never blocks a
      // legitimate registration; only an actual match stops submission.
      try {
        const mobileCheckRes = await fetch("/api/register/check-mobile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile_number: result.data.mobile_number }),
        });
        const mobileCheckJson = await mobileCheckRes.json();
        if (mobileCheckJson?.exists) {
          setError("This mobile number is already registered. Please use another number.");
          return;
        }
      } catch (checkErr) {
        console.error("Registration: mobile duplicate check failed, proceeding anyway.", checkErr);
      }

      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          // Explicit, so the confirmation email always points at wherever
          // this app is actually running (production, a preview deploy, or
          // localhost during development) rather than depending solely on
          // the Supabase project's "Site URL" dashboard default.
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: result.data.full_name,
            mobile_number: result.data.mobile_number,
            school_id: result.data.school_id,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Supabase's anti-enumeration behavior: signing up with an email that
      // already exists can return a fake "success" with no error, but the
      // returned user has no identities attached.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("This email is already registered. Please log in instead.");
        return;
      }

      // Email confirmation disabled: signUp already returned an active
      // session. Always send the user to /login afterward rather than
      // silently keeping them signed in here, so sign this session back
      // out first — they can log straight in since the account is already
      // active.
      if (data.session) {
        await supabase.auth.signOut();
      }

      setSuccessMessage("Account created successfully! You can now log in.");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const authErr = err as { code?: string; status?: number; message?: string; name?: string };
      console.error("Registration failed:", err);

      const message = authErr?.message ?? "";
      const isDuplicate = /already registered|already exists|already been registered/i.test(message);
      const isSchoolTaken = /duplicate key|unique constraint/i.test(message);
      const isRateLimited =
        authErr?.status === 429 ||
        authErr?.code === "over_email_send_rate_limit" ||
        /email rate limit exceeded|rate limit/i.test(message);
      const isInvalidEmail = /invalid email|unable to validate email/i.test(message);
      const isWeakPassword = authErr?.code === "weak_password" || /password.*(weak|should be|at least)/i.test(message);
      const looksLikeNetworkFailure = authErr?.name === "TypeError" || /failed to fetch|network/i.test(message);

      if (isDuplicate) {
        setError("This email is already registered. Please log in instead.");
      } else if (isSchoolTaken) {
        setError(
          "This school already has a headteacher account assigned. Please refresh and choose a different school, or contact the SDEO office."
        );
      } else if (isRateLimited) {
        setError("Too many email requests were made. Please wait a few minutes before trying again.");
      } else if (isInvalidEmail) {
        setError("Please enter a valid email address.");
      } else if (isWeakPassword) {
        setError("Please choose a stronger password (at least 6 characters).");
      } else if (looksLikeNetworkFailure) {
        setError("Could not reach the server. Please check your internet connection and try again.");
      } else {
        // Never show a raw Supabase/technical error to a teacher.
        setError("Could not create your account. Please try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (successMessage) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-brand-50 px-4 py-10 text-center">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
          <Alert type="success">{successMessage}</Alert>
          <Link href="/login" className="mt-4 block">
            <Button fullWidth>Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-brand-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full shadow-lg">
            <Image src="/logo.png" alt="SDEO Male Kulachi" width={64} height={64} className="h-full w-full object-contain" />
          </span>
          <h1 className="text-xl font-bold text-brand-900">Create Headteacher Account</h1>
          <p className="mt-1 text-sm text-gray-600">SDEO (Male) Kulachi Daily Enrollment Monitoring System</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          {error && <Alert type="error">{error}</Alert>}
          {schoolsError && <Alert type="error">{schoolsError}</Alert>}

          <Input
            label="Full Name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            error={errors.full_name}
          />
          <Input
            label="Email Address"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            error={errors.email}
          />
          <Input
            label="Mobile Number"
            placeholder="Enter mobile number"
            value={form.mobile_number}
            onChange={(e) => setForm((f) => ({ ...f, mobile_number: e.target.value }))}
            error={errors.mobile_number}
          />
          <Select
            label="School Name"
            value={form.school_id}
            onChange={(e) => setForm((f) => ({ ...f, school_id: e.target.value }))}
            error={errors.school_id}
            disabled={schoolsLoading}
          >
            <option value="">
              {schoolsLoading ? "Loading schools..." : "Select your school"}
            </option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.school_name}
              </option>
            ))}
          </Select>
          <Input label="EMIS Code" value={selectedSchool?.emis_code ?? ""} disabled readOnly hint="Auto-filled from the selected school" />
          <PasswordInput
            label="Password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={errors.password}
          />
          <PasswordInput
            label="Confirm Password"
            autoComplete="new-password"
            value={form.confirm_password}
            onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
            error={errors.confirm_password}
          />

          <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
            {submitting ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <span className="text-gray-600">Already have an account? </span>
          <Link href="/login" className="font-semibold text-brand-700">
            Login
          </Link>
        </p>
        <p className="mt-2 text-center text-xs">
          <Link href="/" className="font-semibold text-brand-700">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
