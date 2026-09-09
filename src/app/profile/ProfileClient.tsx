"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { profileEditSchema } from "@/lib/validation";
import { useAdminCache } from "@/lib/adminCache";
import { fetchMyProfile, type MyProfileData } from "@/lib/headteacherCache";
import { getMyPendingSchoolChangeRequest, submitSchoolChangeRequest } from "@/lib/services/schoolChangeRequests";
import type { SchoolChangeRequest } from "@/lib/types";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { Skeleton } from "@/components/Skeleton";
import { SchoolPicker, type SchoolOption } from "@/components/SchoolPicker";
import { ChangePasswordForm } from "./ChangePasswordForm";

/**
 * Works for both roles: a headteacher sees their school/EMIS, an admin
 * (school_id is always null for that role) sees "—" there instead. Reads
 * the same "myProfile" cache key Home/Submit/History already share, so
 * opening Profile after any of those tabs is instant.
 */
export function ProfileClient() {
  const cache = useAdminCache<MyProfileData>("myProfile", fetchMyProfile);

  const [mode, setMode] = useState<"view" | "edit" | "password">("view");
  const [form, setForm] = useState({ full_name: "", mobile_number: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // School self-selection (first assignment) and school-change requests
  // (post-assignment, requires admin approval) — see
  // src/app/api/profile/select-school and src/lib/services/schoolChangeRequests.
  const [pendingRequest, setPendingRequest] = useState<SchoolChangeRequest | null | undefined>(undefined);
  const [pickerMode, setPickerMode] = useState<null | "select" | "request">(null);
  const [pickerSubmitting, setPickerSubmitting] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const profileId = cache.data?.profile.id;
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const req = await getMyPendingSchoolChangeRequest(supabase, profileId);
        if (!cancelled) setPendingRequest(req);
      } catch {
        if (!cancelled) setPendingRequest(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  async function handleSchoolPickerConfirm(selectedSchool: SchoolOption, reason: string) {
    if (!cache.data) return;
    setPickerSubmitting(true);
    setPickerError(null);
    try {
      if (pickerMode === "select") {
        const res = await fetch("/api/profile/select-school", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ school_id: selectedSchool.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not select this school.");
        const current = cache.data;
        cache.mutate(() => ({ ...current, profile: json.profile, school: json.school }));
        setSuccess("School selected successfully.");
      } else {
        const supabase = createClient();
        const created = await submitSchoolChangeRequest(supabase, {
          headteacher_id: cache.data.profile.id,
          current_school_id: cache.data.profile.school_id,
          requested_school_id: selectedSchool.id,
          reason: reason.trim() || null,
        });
        setPendingRequest(created);
        setSuccess("Your school change request has been submitted for SDEO review.");
      }
      setPickerMode(null);
    } catch (err) {
      setPickerError((err as Error)?.message ?? "Something went wrong. Please try again.");
    } finally {
      setPickerSubmitting(false);
    }
  }

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

    // Refresh the shared cache immediately — Home/History (which also read
    // "myProfile") reflect the new name/mobile on their next mount too,
    // and the update persists in the database, so it's still there after
    // signing out and back in.
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

  const { profile, school, email } = cache.data;
  const roleLabel = profile.role === "admin" ? "Admin" : "Headteacher";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
      {error && <Alert type="error">{error}</Alert>}
      {success && mode === "view" && <Alert type="success">{success}</Alert>}

      <Card>
        <p className="mb-4 text-lg font-bold text-brand-900">👤 My Profile</p>

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

            {profile.role === "headteacher" && !school ? (
              <div className="space-y-3 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4">
                <p className="text-sm font-semibold text-brand-900">Select Your School</p>
                <p className="text-xs text-gray-600">
                  You don&apos;t have a school assigned yet. Select your school from the official list to continue.
                </p>
                <Button
                  type="button"
                  fullWidth
                  onClick={() => {
                    setPickerError(null);
                    setPickerMode("select");
                  }}
                >
                  🏫 Select My School
                </Button>
              </div>
            ) : (
              <>
                <Input
                  label="School Name"
                  value={school?.school_name ?? "—"}
                  disabled
                  readOnly
                  hint={profile.role === "headteacher" ? "🔒 Assigned School" : "Read only"}
                />
                <Input label="EMIS Code" value={school?.emis_code ?? "—"} disabled readOnly hint="Read only" />
              </>
            )}

            <Input label="Role" value={roleLabel} disabled readOnly hint="Read only" />

            <Button type="button" fullWidth onClick={startEdit}>
              ✏️ Edit Profile
            </Button>

            {profile.role === "headteacher" && school && pendingRequest !== undefined && (
              <>
                {pendingRequest ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800">
                    Your school change request is pending SDEO review.
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => {
                      setPickerError(null);
                      setPickerMode("request");
                    }}
                  >
                    Request School Change
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <p className="mb-3 text-sm font-bold text-brand-900">Security Settings</p>
        {mode === "password" ? (
          <ChangePasswordForm onDone={() => setMode("view")} />
        ) : (
          <Button type="button" variant="secondary" fullWidth onClick={() => setMode("password")}>
            🔒 Change Password
          </Button>
        )}
      </Card>

      {pickerMode && (
        <SchoolPicker
          title={pickerMode === "select" ? "Select Your School" : "Request School Change"}
          description={
            pickerMode === "select"
              ? "Search and select the official school you are the Headteacher of."
              : "Search and select the school you'd like to move to. Your request will be reviewed by the SDEO office."
          }
          confirmLabel={pickerMode === "select" ? "Confirm School" : "Submit Request"}
          showReasonField={pickerMode === "request"}
          submitting={pickerSubmitting}
          errorMessage={pickerError}
          onClose={() => {
            setPickerMode(null);
            setPickerError(null);
          }}
          onConfirm={handleSchoolPickerConfirm}
        />
      )}
    </div>
  );
}
