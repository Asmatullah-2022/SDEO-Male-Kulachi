"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { headteacherSchema, profileEditSchema } from "@/lib/validation";
import { getSchools } from "@/lib/services/schools";
import { updateProfileNameAndMobile } from "@/lib/services/users";
import { getPendingSchoolChangeRequests, resolveSchoolChangeRequest } from "@/lib/services/schoolChangeRequests";
import { useAdminCache } from "@/lib/adminCache";
import type { HeadteacherUser, School, SchoolChangeRequest } from "@/lib/types";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeleton";

const emptyForm = { full_name: "", email: "", mobile_number: "", password: "", school_id: "" };

async function fetchHeadteachers(): Promise<HeadteacherUser[]> {
  const res = await fetch("/api/admin/headteachers");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Could not refresh the user list.");
  return json.users as HeadteacherUser[];
}

/**
 * Reads/writes the "adminUsers" and "schools" cache keys shared with
 * Overview and the Schools tab (see src/lib/adminCache.ts) — the schools
 * dropdown here reuses the exact same fetch Overview/Schools already made,
 * instead of the school list being queried a third time.
 */
export function UsersManager() {
  const usersCache = useAdminCache<HeadteacherUser[]>("adminUsers", fetchHeadteachers);
  const schoolsCache = useAdminCache<School[]>("schools", () => getSchools(createClient()));
  const requestsCache = useAdminCache<SchoolChangeRequest[]>("schoolChangeRequests", () =>
    getPendingSchoolChangeRequests(createClient())
  );
  const users = usersCache.data ?? [];
  const schools = schoolsCache.data ?? [];
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const schoolById = new Map(schools.map((s) => [s.id, s]));
  const schoolName = (id: string | null) => (id ? schoolById.get(id)?.school_name ?? "Unknown School" : null);

  const headteacherCount = users.filter((u) => u.role === "headteacher").length;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? users.filter((u) => {
        const school = schoolName(u.school_id) ?? "";
        return (
          u.full_name.toLowerCase().includes(query) ||
          (u.email ?? "").toLowerCase().includes(query) ||
          (u.mobile_number ?? "").toLowerCase().includes(query) ||
          school.toLowerCase().includes(query)
        );
      })
    : users;

  const availableSchools = schools.filter(
    (s) => !users.some((u) => u.school_id === s.id && u.role === "headteacher")
  );

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await usersCache.refresh();
    } catch (err) {
      setError((err as Error)?.message ?? "Could not refresh the user list. Please check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleCancelForm() {
    setForm(emptyForm);
    setErrors({});
    setEditingUserId(null);
    setShowForm(false);
  }

  function startEditUser(u: HeadteacherUser) {
    setForm({ ...emptyForm, full_name: u.full_name, mobile_number: u.mobile_number ?? "" });
    setErrors({});
    setError(null);
    setSuccess(null);
    setEditingUserId(u.id);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Editing an existing user only ever touches Full Name and Mobile
    // Number — email, password, school assignment, and role are untouched
    // here (school reassignment has its own dedicated control below).
    if (editingUserId) {
      const editResult = profileEditSchema.safeParse({
        full_name: form.full_name,
        mobile_number: form.mobile_number,
      });
      if (!editResult.success) {
        const errs: Record<string, string> = {};
        editResult.error.issues.forEach((issue) => {
          errs[String(issue.path[0])] = issue.message;
        });
        setErrors(errs);
        return;
      }
      setErrors({});
      setSaving(true);
      try {
        const supabase = createClient();
        const updated = await updateProfileNameAndMobile(supabase, editingUserId, editResult.data);
        usersCache.mutate((prev) => (prev ?? []).map((u) => (u.id === editingUserId ? { ...u, ...updated } : u)));
        setSuccess(`${editResult.data.full_name}'s profile updated successfully.`);
        handleCancelForm();
      } catch {
        setError("Could not update this user's profile. Please try again.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const result = headteacherSchema.safeParse(form);
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

    const res = await fetch("/api/admin/headteachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error ?? "Could not create headteacher account.");
      return;
    }

    const supabase = createClient();
    const { data: newProfile } = await supabase.from("profiles").select("*").eq("id", json.id).single();
    if (newProfile) {
      const newUser: HeadteacherUser = { ...newProfile, email: json.email ?? result.data.email };
      usersCache.mutate((prev) =>
        [...(prev ?? []), newUser].sort((a, b) => a.full_name.localeCompare(b.full_name))
      );
    }

    setSuccess(`Headteacher account created for ${result.data.full_name}.`);
    setForm(emptyForm);
    setShowForm(false);
  }

  function renderReassignControl(u: HeadteacherUser) {
    if (u.role !== "headteacher") return <span className="text-xs text-gray-400">—</span>;
    return (
      <select
        className="w-full rounded-lg border border-brand-200 px-2 py-1.5 text-xs md:w-auto"
        value={u.school_id ?? ""}
        disabled={reassigning === u.id}
        onChange={(e) => handleReassign(u.id, e.target.value)}
      >
        <option value="">Not assigned</option>
        {schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.school_name}
          </option>
        ))}
      </select>
    );
  }

  function renderStatusBadge(u: HeadteacherUser) {
    if (u.role === "admin") {
      return (
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">Admin</span>
      );
    }
    if (u.school_id) {
      return (
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
          Assigned
        </span>
      );
    }
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        Not Assigned
      </span>
    );
  }

  async function handleReassign(userId: string, schoolId: string) {
    setReassigning(userId);
    setError(null);
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({ school_id: schoolId || null })
      .eq("id", userId)
      .select()
      .single();
    setReassigning(null);
    if (updateError) {
      setError("Could not reassign school.");
      return;
    }
    usersCache.mutate((prev) => (prev ?? []).map((u) => (u.id === userId ? { ...u, ...data } : u)));
  }

  /**
   * Approving reassigns the school directly (same authenticated-admin
   * update path as the reassign dropdown above) and then marks the
   * request resolved. If the target school picked up another headteacher
   * in the meantime, the profiles update fails on the existing
   * profiles_school_id_headteacher_unique constraint — caught below, and
   * the request is left pending rather than silently marked resolved.
   */
  async function handleApproveRequest(req: SchoolChangeRequest) {
    if (!req.requested_school_id) return;
    setResolvingRequestId(req.id);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ school_id: req.requested_school_id })
        .eq("id", req.headteacher_id);
      if (updateError) throw updateError;

      await resolveSchoolChangeRequest(supabase, req.id, { status: "approved", resolved_by: user.id });

      requestsCache.mutate((prev) => (prev ?? []).filter((r) => r.id !== req.id));
      usersCache.mutate((prev) =>
        (prev ?? []).map((u) => (u.id === req.headteacher_id ? { ...u, school_id: req.requested_school_id } : u))
      );
      setSuccess("School change approved and reassigned.");
    } catch {
      setError(
        "Could not approve this request — the school may already be assigned to another Headteacher. Please review and reassign manually if needed."
      );
    } finally {
      setResolvingRequestId(null);
    }
  }

  async function handleRejectRequest(req: SchoolChangeRequest) {
    setResolvingRequestId(req.id);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      await resolveSchoolChangeRequest(supabase, req.id, { status: "rejected", resolved_by: user.id });
      requestsCache.mutate((prev) => (prev ?? []).filter((r) => r.id !== req.id));
      setSuccess("School change request rejected.");
    } catch {
      setError("Could not reject this request. Please try again.");
    } finally {
      setResolvingRequestId(null);
    }
  }

  return (
    <div className="space-y-6">
      {(error || usersCache.error || schoolsCache.error) && (
        <Alert type="error">{error ?? usersCache.error ?? schoolsCache.error}</Alert>
      )}
      {success && <Alert type="success">{success}</Alert>}

      {/* Pending School Change Requests — surfaced above the user list since
          these need admin action. Hidden entirely when there are none. */}
      {(requestsCache.data?.length ?? 0) > 0 && (
        <Card>
          <p className="mb-3 text-sm font-bold text-brand-900">📋 Pending School Change Requests</p>
          <div className="space-y-3">
            {requestsCache.data!.map((req) => {
              const headteacher = users.find((u) => u.id === req.headteacher_id);
              const currentSchool = req.current_school_id ? schoolById.get(req.current_school_id) : null;
              const requestedSchool = req.requested_school_id ? schoolById.get(req.requested_school_id) : null;
              const resolving = resolvingRequestId === req.id;
              return (
                <div key={req.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-brand-900">{headteacher?.full_name ?? "Unknown Headteacher"}</p>
                  <p className="text-xs text-gray-600">
                    From: {currentSchool?.school_name ?? "Not assigned"} → To: {requestedSchool?.school_name ?? "Unknown"}{" "}
                    {requestedSchool && `(EMIS: ${requestedSchool.emis_code})`}
                  </p>
                  {req.reason && <p className="mt-1 text-xs italic text-gray-500">&ldquo;{req.reason}&rdquo;</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      loading={resolving}
                      onClick={() => handleApproveRequest(req)}
                      className="min-h-[44px] px-3 py-2 text-xs"
                    >
                      ✅ Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      loading={resolving}
                      onClick={() => handleRejectRequest(req)}
                      className="min-h-[44px] px-3 py-2 text-xs"
                    >
                      ✕ Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Search + stats — shown first so admins can find an existing user before adding a new one */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-brand-900">
              Total Headteachers: {headteacherCount} <span className="text-gray-400">·</span> Total Users: {users.length}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              loading={refreshing}
              className="px-3 py-2 text-sm"
            >
              ↻ Refresh
            </Button>
          </div>
          <Input
            placeholder="Search Name, Email, Mobile, School"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-w-0"
            style={{ fontSize: "0.875rem" }}
          />
          {query && (
            <p className="text-xs text-gray-500">
              {filtered.length} user{filtered.length === 1 ? "" : "s"} matching &ldquo;{search.trim()}&rdquo;
            </p>
          )}
        </div>
      </Card>

      {/* User list */}
      <Card>
        {usersCache.loading && users.length === 0 ? (
          <TableSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          users.length === 0 ? (
            <EmptyState
              icon="👤"
              title="No users found"
              description="Add your first headteacher using the form below, or press Refresh if you expected data here."
            />
          ) : (
            <EmptyState icon="🔍" title="No users match your search" />
          )
        ) : (
          <>
            {/* Mobile card list (below 768px) — email addresses get full width, no horizontal scrolling */}
            <div className="divide-y divide-brand-50 md:hidden">
              {filtered.map((u) => (
                <div key={u.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-900">{u.full_name}</p>
                      <p className="mt-0.5 break-all text-xs text-gray-600">{u.email ?? "—"}</p>
                      <p className="text-xs text-gray-500">{u.mobile_number ?? "—"}</p>
                    </div>
                    <span className="shrink-0">{renderStatusBadge(u)}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    School: {u.role === "headteacher" ? schoolName(u.school_id) ?? "Not assigned" : "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {u.role === "headteacher" && renderReassignControl(u)}
                    <button
                      type="button"
                      aria-label={`Edit ${u.full_name}`}
                      onClick={() => startEditUser(u)}
                      className="min-h-[44px] rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700 active:bg-brand-100"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tablet/desktop table (768px and up) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-gray-500">
                    <th className="py-2 pr-2">Full Name</th>
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Mobile</th>
                    <th className="py-2 pr-2">Assigned School</th>
                    <th className="py-2 pr-2">Account Status</th>
                    <th className="py-2 pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-brand-50">
                      <td className="py-2 pr-2 font-medium text-brand-900">{u.full_name}</td>
                      <td className="py-2 pr-2 text-gray-600 break-all">{u.email ?? "—"}</td>
                      <td className="py-2 pr-2 text-gray-600">{u.mobile_number ?? "—"}</td>
                      <td className="py-2 pr-2 text-gray-600">
                        {u.role === "headteacher" ? schoolName(u.school_id) ?? "Not assigned" : "—"}
                      </td>
                      <td className="py-2 pr-2">{renderStatusBadge(u)}</td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderReassignControl(u)}
                          <button
                            type="button"
                            aria-label={`Edit ${u.full_name}`}
                            onClick={() => startEditUser(u)}
                            className="min-h-[44px] rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-700 active:bg-brand-100"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Add Headteacher — collapsed by default so search & list are prioritized on mobile */}
      <Card>
        {!showForm ? (
          <Button type="button" variant="secondary" fullWidth onClick={() => setShowForm(true)}>
            + Add New Headteacher
          </Button>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-brand-900">
                {editingUserId ? "Edit Headteacher" : "Add New Headteacher"}
              </p>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-xs font-semibold text-gray-500 hover:text-brand-700"
              >
                ✕ Close
              </button>
            </div>
            {editingUserId && (
              <p className="mb-3 text-xs text-gray-500">
                Only Full Name and Mobile Number can be changed here. Use the school dropdown in the list
                above to reassign a school, and remind the headteacher they can update their own password
                and mobile number from their Profile page.
              </p>
            )}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Full Name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                error={errors.full_name}
              />
              {!editingUserId && (
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  error={errors.email}
                />
              )}
              <Input
                label="Mobile Number"
                value={form.mobile_number}
                onChange={(e) => setForm((f) => ({ ...f, mobile_number: e.target.value }))}
                error={errors.mobile_number}
                placeholder="03001234567"
              />
              {!editingUserId && (
                <>
                  <Input
                    label="Temporary Password"
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    error={errors.password}
                    hint="Share this securely with the headteacher; they can change it later."
                  />
                  <Select
                    label="Assign School"
                    value={form.school_id}
                    onChange={(e) => setForm((f) => ({ ...f, school_id: e.target.value }))}
                    error={errors.school_id}
                  >
                    <option value="">Select a school</option>
                    {availableSchools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.school_name} - {s.emis_code}
                      </option>
                    ))}
                  </Select>
                </>
              )}

              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit" loading={saving}>
                  {editingUserId ? "Save Changes" : "Add Headteacher"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
