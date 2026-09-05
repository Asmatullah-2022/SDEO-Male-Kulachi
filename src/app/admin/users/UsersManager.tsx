"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { headteacherSchema } from "@/lib/validation";
import type { Profile, School } from "@/lib/types";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";

const emptyForm = { full_name: "", email: "", mobile_number: "", password: "", school_id: "" };

interface Props {
  initialUsers: Profile[];
  schools: School[];
  schoolsError?: string | null;
}

export function UsersManager({ initialUsers, schools, schoolsError = null }: Props) {
  const [users, setUsers] = useState<Profile[]>(initialUsers);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(schoolsError);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reassigning, setReassigning] = useState<string | null>(null);

  const schoolName = (id: string | null) => schools.find((s) => s.id === id)?.school_name ?? "Not assigned";

  const availableSchools = schools.filter(
    (s) => !users.some((u) => u.school_id === s.id && u.role === "headteacher")
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
    if (newProfile) setUsers((prev) => [...prev, newProfile as Profile].sort((a, b) => a.full_name.localeCompare(b.full_name)));

    setSuccess(`Headteacher account created for ${result.data.full_name}.`);
    setForm(emptyForm);
  }

  async function handleReassign(userId: string, schoolId: string) {
    setReassigning(userId);
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
    setUsers((prev) => prev.map((u) => (u.id === userId ? (data as Profile) : u)));
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-sm font-bold text-brand-900">Add New Headteacher</p>
        {error && <div className="mb-3"><Alert type="error">{error}</Alert></div>}
        {success && <div className="mb-3"><Alert type="success">{success}</Alert></div>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Full Name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            error={errors.full_name}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            error={errors.email}
          />
          <Input
            label="Mobile Number"
            value={form.mobile_number}
            onChange={(e) => setForm((f) => ({ ...f, mobile_number: e.target.value }))}
            error={errors.mobile_number}
          />
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

          <div className="sm:col-span-2">
            <Button type="submit" loading={saving}>
              Add Headteacher
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-bold text-brand-900">All Users ({users.length})</p>
        {users.length === 0 ? (
          <EmptyState icon="👤" title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-gray-500">
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Mobile</th>
                  <th className="py-2 pr-2">Role</th>
                  <th className="py-2 pr-2">Assigned School</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-brand-50">
                    <td className="py-2 pr-2 font-medium text-brand-900">{u.full_name}</td>
                    <td className="py-2 pr-2 text-gray-600">{u.mobile_number ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      {u.role === "headteacher" ? (
                        <select
                          className="rounded-lg border border-brand-200 px-2 py-1 text-xs"
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
                      ) : (
                        schoolName(u.school_id)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
