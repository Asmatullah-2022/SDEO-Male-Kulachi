"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validation";
import { Button } from "@/components/Button";
import { PasswordInput } from "@/components/PasswordInput";
import { Alert } from "@/components/Alert";
import { Skeleton } from "@/components/Skeleton";

type LinkStatus = "checking" | "ready" | "invalid";

/**
 * Reached via the link in the password-reset email
 * (supabase.auth.resetPasswordForEmail's redirectTo). Supabase's browser
 * client auto-detects the recovery token in the URL and establishes a
 * temporary session before this component's effects run; we wait for
 * either the PASSWORD_RECOVERY auth event or an already-present session,
 * and treat neither showing up within a few seconds as an expired/invalid
 * link — never assume the link worked.
 */
export function ResetPasswordClient() {
  const router = useRouter();
  const [status, setStatus] = useState<LinkStatus>("checking");
  const [values, setValues] = useState({ new_password: "", confirm_password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !settled) {
        settled = true;
        setStatus("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!settled && data.session) {
        settled = true;
        setStatus("ready");
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setStatus("invalid");
      }
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (submitting) return; // blocks a double-tap from firing two updates at once

    const result = resetPasswordSchema.safeParse(values);
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
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: result.data.new_password });
      if (updateError) throw updateError;

      // Sign out the temporary recovery session so the teacher lands on
      // /login and signs in explicitly with the new password, rather
      // than being silently left logged in here.
      await supabase.auth.signOut();

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const authErr = err as { status?: number; code?: string; message?: string; name?: string };
      console.error("Password update failed:", err);

      const message = authErr?.message ?? "";
      const isRateLimited =
        authErr?.status === 429 || authErr?.code === "over_request_rate_limit" || /rate limit/i.test(message);
      const isWeakPassword = authErr?.code === "weak_password" || /password.*(weak|should be|at least)/i.test(message);
      const looksLikeNetworkFailure = authErr?.name === "TypeError" || /failed to fetch|network/i.test(message);

      if (isRateLimited) {
        setError("Too many requests. Please wait a few minutes before trying again.");
      } else if (isWeakPassword) {
        setError("Password must contain at least 8 characters, including uppercase, lowercase, and a number.");
      } else if (looksLikeNetworkFailure) {
        setError("Unable to update your password. Please check your internet connection and try again.");
      } else {
        // Never show a raw Supabase/technical error to a teacher.
        setError("This reset link may have expired. Please request a new one.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-brand-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full shadow-lg">
            <Image src="/logo.png" alt="SDEO Male Kulachi" width={64} height={64} className="h-full w-full object-contain" />
          </span>
          <h1 className="text-xl font-bold text-brand-900">Create New Password</h1>
          <p className="mt-1 text-sm text-gray-600">SDEO (Male) Kulachi Daily Enrollment Monitoring System</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {status === "checking" && <Skeleton className="h-40 w-full" />}

          {status === "invalid" && (
            <div className="space-y-4 text-center">
              <Alert type="error">This password reset link is invalid or has expired. Please request a new one.</Alert>
              <Link href="/forgot-password" className="block">
                <Button type="button" fullWidth>
                  Request a New Link
                </Button>
              </Link>
            </div>
          )}

          {status === "ready" &&
            (success ? (
              <Alert type="success">Password updated successfully! Redirecting you to the login page...</Alert>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && <Alert type="error">{error}</Alert>}
                <PasswordInput
                  label="New Password"
                  autoComplete="new-password"
                  value={values.new_password}
                  onChange={(e) => setValues((v) => ({ ...v, new_password: e.target.value }))}
                  error={errors.new_password}
                />
                <PasswordInput
                  label="Confirm New Password"
                  autoComplete="new-password"
                  value={values.confirm_password}
                  onChange={(e) => setValues((v) => ({ ...v, confirm_password: e.target.value }))}
                  error={errors.confirm_password}
                />
                <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
                  {submitting ? "Updating..." : "Update Password"}
                </Button>
              </form>
            ))}
        </div>

        <p className="mt-6 text-center text-xs">
          <Link href="/login" className="font-semibold text-brand-700">
            ← Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
