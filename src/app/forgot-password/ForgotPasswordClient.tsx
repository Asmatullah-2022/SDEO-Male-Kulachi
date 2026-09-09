"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema } from "@/lib/validation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Alert } from "@/components/Alert";

/**
 * Requests a password reset link via Supabase's own recovery flow
 * (supabase.auth.resetPasswordForEmail) — no separate/new auth system.
 * Deliberately shows the same success message whether or not the email
 * is actually registered: Supabase itself doesn't reveal that (to avoid
 * account enumeration), so this form can't and shouldn't either.
 */
export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    if (submitting) return; // blocks a double-tap from firing two requests at once

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(result.data.email, {
        // Matches wherever this app is actually running (production,
        // preview, or local dev) rather than a hardcoded domain — same
        // pattern already used for the registration confirmation email.
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      const authErr = err as { status?: number; code?: string; message?: string; name?: string };
      console.error("Forgot password request failed:", err);

      const message = authErr?.message ?? "";
      const isRateLimited =
        authErr?.status === 429 || authErr?.code === "over_email_send_rate_limit" || /rate limit/i.test(message);
      const looksLikeNetworkFailure = authErr?.name === "TypeError" || /failed to fetch|network/i.test(message);

      if (isRateLimited) {
        setError("Too many requests. Please wait a few minutes before trying again.");
      } else if (looksLikeNetworkFailure) {
        setError("Unable to send reset link. Please check your internet connection and try again.");
      } else {
        // Never show a raw Supabase/technical error to a teacher.
        setError("Unable to send reset link. Please try again in a moment.");
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
          <h1 className="text-xl font-bold text-brand-900">Reset Your Password</h1>
          <p className="mt-1 text-sm text-gray-600">
            Enter your registered email address to receive a password reset link.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {sent ? (
            <Alert type="success">
              Password reset link has been sent to your email. Please check your inbox.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <Alert type="error">{error}</Alert>}
              <Input
                label="Email Address"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldError ?? undefined}
              />
              <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
                {submitting ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}
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
