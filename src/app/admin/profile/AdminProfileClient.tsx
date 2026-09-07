"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { profileEditSchema } from "@/lib/validation";
import { useAdminCache } from "@/lib/adminCache";
import { fetchMyProfile, type MyProfileData } from "@/lib/headteacherCache";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { Skeleton } from "@/components/Skeleton";

/**
 * Admin-only profile view: Full Name, Email (read-only), Mobile Number
 * (editable), Role. Deliberately omits School Name/EMIS Code (school_id is
 * always null for an admin) and the password-change flow, unlike the
 * headteacher-shared ProfileClient this mirrors. Reads/writes the same
 * "myProfile" cache key and profiles table, so no schema or RLS change is
 * needed — profiles_admin_update + restrict_profile_self_update already
 * allow an admin to edit their own full_name/mobile_number.
 */
export function AdminProfileClient() {
  const cache = useAdminCache<MyProfileData>("myProfile", fetchMyProfile);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState({ full_name: "", mobile_number: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function startEdit() {
    if (!cache.data) return;
    setForm({
      full_name: cache.data.profile.full_name,
      mobile_number: cache.data.profile.mobile_number ?? "",
    });
    setErrors({});
    setError(null);
    setSuccess(null);
    setMode("edit");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const current = cache.data;
    if (!current) return;
    setError(null);

    const result = profileEditSchema.safeParse(form);
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
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: result.data.full_name, mobile_number: result.data.mobile_number })
      .eq("id", current.profile.id)
      .select()
      .single();

    setSaving(false);

    if (updateError || !data) {
      setError("Could not save your changes. Please try again.");
      return;
    }

    cache.mutate(() => ({ ...current, profile: data }));
    setSuccess("Profile updated successfully.");
    setMode("view");
  }

  if (cache.error) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Alert type="error">{cache.error}</Alert>
      </div>
    );
  }

  if (cache.loading || !cache.data) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const { profile, email } = cache.data;
  const roleLabel = profile.role === "admin" ? "Admin / SDEO" : "Headteacher";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
      {error && <Alert type="error">{error}</Alert>}
      {success && mode === "view" && <Alert type="success">{success}</Alert>}

      <Card>
        <p className="mb-4 text-lg font-bold text-brand-900">👤 Admin Profile</p>

        {mode === "edit" ? (
          <form onSubmit={handleSave} className="space-y-4">
            <p className="text-sm font-bold text-brand-900">Edit Profile</p>
            <Input
              label="Full Name"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              error={errors.full_name}
            />
            <Input
              label="Mobile Number"
              value={form.mobile_number}
              onChange={(e) => setForm((f) => ({ ...f, mobile_number: e.target.value }))}
              error={errors.mobile_number}
              placeholder="03001234567"
            />
            <div className="flex gap-3">
              <Button type="submit" loading={saving}>
                Save Changes
              </Button>
              <Button type="button" variant="outline" onClick={() => setMode("view")}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-bold text-brand-900">Profile Information</p>
            <Input label="Full Name" value={profile.full_name} disabled readOnly />
            <Input label="Email Address" value={email ?? "—"} disabled readOnly hint="Read only" />
            <Input label="Mobile Number" value={profile.mobile_number ?? "—"} disabled readOnly />
            <Input label="Role" value={roleLabel} disabled readOnly hint="Read only" />

            <Button type="button" fullWidth onClick={startEdit}>
              ✏️ Edit Profile
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
