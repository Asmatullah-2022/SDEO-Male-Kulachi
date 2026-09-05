"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { schoolSchema } from "@/lib/validation";
import { addSchool, deleteSchool, getSchools, updateSchool } from "@/lib/services/schools";
import type { School } from "@/lib/types";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";

const emptyForm = {
  school_name: "",
  emis_code: "",
  district: "Dera Ismail Khan",
  tehsil: "Kulachi",
  circle: "",
  status: "active" as "active" | "inactive",
};

interface Props {
  initialSchools: School[];
  initialError?: string | null;
}

export function SchoolsManager({ initialSchools, initialError = null }: Props) {
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = schools.filter(
    (s) =>
      s.school_name.toLowerCase().includes(search.toLowerCase()) ||
      s.emis_code.toLowerCase().includes(search.toLowerCase())
  );

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const supabase = createClient();
      const fresh = await getSchools(supabase);
      setSchools(fresh);
    } catch {
      setError("Could not refresh the school list. Please check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  }

  function startEdit(school: School) {
    setEditingId(school.id);
    setForm({
      school_name: school.school_name,
      emis_code: school.emis_code,
      district: school.district,
      tehsil: school.tehsil,
      circle: school.circle ?? "",
      status: school.status,
    });
    setError(null);
    setSuccess(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const result = schoolSchema.safeParse(form);
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
    const payload = { ...result.data, circle: result.data.circle || null };

    try {
      if (editingId) {
        const updated = await updateSchool(supabase, editingId, payload);
        setSchools((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
        setSuccess("School updated successfully.");
      } else {
        const created = await addSchool(supabase, payload);
        setSchools((prev) => [...prev, created].sort((a, b) => a.school_name.localeCompare(b.school_name)));
        setSuccess("School added successfully.");
      }
      resetForm();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = (err as { message?: string })?.message;
      setError(code === "23505" ? "A school with this EMIS code already exists." : message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this school? This action cannot be undone.")) return;
    setError(null);
    const supabase = createClient();
    try {
      await deleteSchool(supabase, id);
      setSchools((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Could not delete school. It may have existing enrollment reports or a headteacher assigned.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="mb-3 text-sm font-bold text-brand-900">
          {editingId ? "Edit School" : "Add New School"}
        </p>
        {error && <div className="mb-3"><Alert type="error">{error}</Alert></div>}
        {success && <div className="mb-3"><Alert type="success">{success}</Alert></div>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="School Name"
            value={form.school_name}
            onChange={(e) => setForm((f) => ({ ...f, school_name: e.target.value }))}
            error={errors.school_name}
          />
          <Input
            label="EMIS Code"
            value={form.emis_code}
            onChange={(e) => setForm((f) => ({ ...f, emis_code: e.target.value }))}
            error={errors.emis_code}
          />
          <Input
            label="District"
            value={form.district}
            onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
            error={errors.district}
          />
          <Input
            label="Tehsil"
            value={form.tehsil}
            onChange={(e) => setForm((f) => ({ ...f, tehsil: e.target.value }))}
            error={errors.tehsil}
          />
          <Input
            label="Circle (optional)"
            value={form.circle}
            onChange={(e) => setForm((f) => ({ ...f, circle: e.target.value }))}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "inactive" }))}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" loading={saving}>
              {editingId ? "Save Changes" : "Add School"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-brand-900">Total Schools: {schools.length}</p>
          <div className="flex flex-1 items-center justify-end gap-2">
            <Input
              placeholder="Search by name or EMIS code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs py-2"
            />
            <Button type="button" variant="outline" onClick={handleRefresh} loading={refreshing} className="px-3 py-2 text-sm">
              ↻ Refresh
            </Button>
          </div>
        </div>

        {refreshing ? (
          <Spinner label="Refreshing schools..." />
        ) : filtered.length === 0 ? (
          schools.length === 0 ? (
            <EmptyState
              icon="🏫"
              title="No schools found"
              description="Add your first school using the form above, or press Refresh if you expected data here."
            />
          ) : (
            <EmptyState icon="🔍" title="No schools match your search" />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-gray-500">
                  <th className="py-2 pr-2">School Name</th>
                  <th className="py-2 pr-2">EMIS Code</th>
                  <th className="py-2 pr-2">District</th>
                  <th className="py-2 pr-2">Tehsil</th>
                  <th className="py-2 pr-2">Circle</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-brand-50">
                    <td className="py-2 pr-2 font-medium text-brand-900">{s.school_name}</td>
                    <td className="py-2 pr-2 text-gray-600">{s.emis_code}</td>
                    <td className="py-2 pr-2 text-gray-600">{s.district}</td>
                    <td className="py-2 pr-2 text-gray-600">{s.tehsil}</td>
                    <td className="py-2 pr-2 text-gray-600">{s.circle ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.status === "active" ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="flex gap-2 py-2 pr-2">
                      <button className="text-xs font-semibold text-brand-700" onClick={() => startEdit(s)}>
                        Edit
                      </button>
                      <button className="text-xs font-semibold text-red-600" onClick={() => handleDelete(s.id)}>
                        Delete
                      </button>
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
