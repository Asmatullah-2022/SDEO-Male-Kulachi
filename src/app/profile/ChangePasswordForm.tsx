"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { changePasswordSchema } from "@/lib/validation";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";

/**
 * No "current password" field: supabase.auth.updateUser() operates on the
 * caller's already-authenticated session and doesn't require re-proving
 * the current password (this is Supabase's standard, secure pattern for
 * a signed-in settings screen — distinct from an email-link password
 * reset, which does need extra verification since there's no live session).
 */
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [values, setValues] = useState({ new_password: "", confirm_password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const result = changePasswordSchema.safeParse(values);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        errs[String(issue.path[0])] = issue.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: result.data.new_password,
    });

    setSaving(false);

    if (updateError) {
      setError(updateError.message || "Could not change your password. Please try again.");
      return;
    }

    setSuccess(true);
    setValues({ new_password: "", confirm_password: "" });
  }

  if (success) {
    return (
      <div className="space-y-4">
        <Alert type="success">Password changed successfully.</Alert>
        <Button type="button" variant="outline" fullWidth onClick={onDone}>
          Back to Profile
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <Input
        label="New Password"
        type="password"
        autoComplete="new-password"
        value={values.new_password}
        onChange={(e) => setValues((v) => ({ ...v, new_password: e.target.value }))}
        error={errors.new_password}
      />
      <Input
        label="Confirm New Password"
        type="password"
        autoComplete="new-password"
        value={values.confirm_password}
        onChange={(e) => setValues((v) => ({ ...v, confirm_password: e.target.value }))}
        error={errors.confirm_password}
      />
      <div className="flex gap-3">
        <Button type="submit" loading={saving}>
          Update Password
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
