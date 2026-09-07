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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        errs[String(issue.path[0])] = issue.message;
      });
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    });

    if (signInError) {
      setError("Invalid email/mobile number or password. Please try again.");
      setLoading(false);
      return;
    }

    if (data.user) {
      // Defense in depth alongside SignOutButton's clear: guarantees a
      // fresh fetch for THIS session's user even if a previous session in
      // this tab ended some other way (expired token, closed tab without
      // signing out) and left cached profile/school/report data behind.
      clearAllCache();

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      router.replace(redirectedFrom || (profile?.role === "admin" ? "/admin" : "/dashboard"));
      router.refresh();
    }
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
