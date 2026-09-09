"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { clearAllCache } from "@/lib/adminCache";
import { loginSchema } from "@/lib/validation";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Alert } from "@/components/Alert";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setUnconfirmedEmail(null);
    setResendMessage(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        errs[String(issue.path[0])] = issue.message;
      });
      setFieldErrors(errs);
      return;
    }

    // The field accepts either an email or a mobile number. Supabase Auth
    // here is email/password only, so a non-email identifier has to be
    // resolved to its account's email first — see
    // /api/login/resolve-identifier. An email-shaped identifier is used
    // as-is with no extra request. Declared here (not inside the try
    // block) so the catch block below can still reference it.
    let emailToUse = result.data.email.trim();
    if (emailToUse.includes("@")) emailToUse = emailToUse.toLowerCase();

    if (loading) return; // guards against a double-tap/double-submit firing two sign-ins at once
    setLoading(true);
    try {
      const supabase = createClient();

      if (!emailToUse.includes("@")) {
        try {
          const res = await fetch("/api/login/resolve-identifier", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: emailToUse }),
          });
          const json = await res.json();
          if (json?.email) emailToUse = json.email;
        } catch (resolveErr) {
          // Non-fatal — fall through and attempt sign-in with the raw
          // typed value below; that fails cleanly with the same
          // generic invalid-credentials message.
          console.error("Login: could not resolve mobile number to an email, trying it as-is.", resolveErr);
        }
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: result.data.password,
      });

      if (signInError) throw signInError;
      if (!data?.user) throw new Error("Sign-in did not return a user session.");

      // Defense in depth alongside SignOutButton's clear: guarantees a
      // fresh fetch for THIS session's user even if a previous session in
      // this tab ended some other way (expired token, closed tab without
      // signing out) and left cached profile/school/report data behind.
      clearAllCache();

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        // Non-fatal — still route the user in; role just falls back to
        // the headteacher dashboard below rather than getting stuck here.
        console.error("Login: signed in, but could not load the profile role.", profileError);
      }

      router.replace(redirectedFrom || (profile?.role === "admin" ? "/admin" : "/dashboard"));
      router.refresh();
    } catch (err) {
      const authErr = err as { code?: string; message?: string; name?: string };
      console.error("Login failed:", err);

      const authErrWithStatus = authErr as { status?: number };
      const isUnconfirmed =
        authErr?.code === "email_not_confirmed" || /email not confirmed/i.test(authErr?.message ?? "");
      const isRateLimited =
        authErrWithStatus?.status === 429 ||
        authErr?.code === "over_request_rate_limit" ||
        /rate limit|too many requests/i.test(authErr?.message ?? "");
      const looksLikeNetworkFailure =
        authErr?.name === "TypeError" || /failed to fetch|network|fetch/i.test(authErr?.message ?? "");

      if (isUnconfirmed) {
        setError(
          "Your account exists but hasn't been confirmed yet. Please check your email (including spam/junk) for the confirmation link before logging in."
        );
        setUnconfirmedEmail(emailToUse);
      } else if (isRateLimited) {
        setError("Too many login attempts. Please wait a few minutes and try again.");
      } else if (looksLikeNetworkFailure) {
        setError("Could not reach the server. Please check your internet connection and try again.");
      } else {
        setError("Invalid email/mobile number or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!unconfirmedEmail) return;
    setResending(true);
    setResendMessage(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: unconfirmedEmail });
    setResending(false);
    setResendMessage(
      resendError
        ? "Could not resend the confirmation email. Please try again in a moment."
        : "Confirmation email sent. Please check your inbox (and spam/junk folder)."
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-brand-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full shadow-lg">
            <Image src="/logo.png" alt="SDEO Male Kulachi" width={64} height={64} className="h-full w-full object-contain" />
          </span>
          <h1 className="text-xl font-bold text-brand-900">Headteacher Login</h1>
          <p className="mt-1 text-sm text-gray-600">
            SDEO (Male) Kulachi Daily Enrollment Monitoring System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
          {error && <Alert type="error">{error}</Alert>}
          {resendMessage && <Alert type={resendMessage.startsWith("Could not") ? "error" : "success"}>{resendMessage}</Alert>}
          {unconfirmedEmail && (
            <Button type="button" variant="outline" fullWidth loading={resending} onClick={handleResendConfirmation}>
              Resend Confirmation Email
            </Button>
          )}

          <Input
            label="Email or Mobile Number"
            name="email"
            type="text"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />

          <p className="-mt-2 text-right text-xs">
            <Link href="/forgot-password" className="font-semibold text-brand-700">
              Forgot Password?
            </Link>
          </p>

          <Button type="submit" fullWidth loading={loading}>
            Login
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Having trouble logging in? Contact the SDEO (Male) Kulachi office.
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
