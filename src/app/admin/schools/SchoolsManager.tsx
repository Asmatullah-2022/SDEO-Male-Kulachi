"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { schoolSchema } from "@/lib/validation";
import type { School } from "@/lib/types";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { EmptyState } from "@/components/EmptyState";

const emptyForm = {
  school_name: "",
  emis_code: "",
  district: "Dera Ismail Khan",
  tehsil: "Kulachi",
  circle: "",
  status: "active" as "active" | "inactive",
};

export function SchoolsManager({ initialSchools }: { initialSchools: School[] }) {
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = schools.filter(
    (s) =>
      s.school_name.toLowerCase().includes(search.toLowerCase()) ||
      s.emis_code.toLowerCase().includes(search.toLowerCase())
  );

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

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from("schools")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single();
      setSaving(false);
      if (updateError) {
        setError(updateError.code === "23505" ? "A school with this EMIS code already exists." : updateError.message);
        return;
      }
      setSchools((prev) => prev.map((s) => (s.id === editingId ? (data as School) : s)));
      setSuccess("School updated successfully.");
      resetForm();
    } else {
      const { data, error: insertError } = await supabase.from("schools").insert(payload).select().single();
      setSaving(false);
      if (insertError) {
        setError(insertError.code === "23505" ? "A school with this EMIS code already exists." : insertError.message);
        return;
      }
      setSchools((prev) => [...prev, data as School].sort((a, b) => a.school_name.localeCompare(b.school_name)));
      setSuccess("School added successfully.");
      resetForm();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this school? This cannot be undone.")) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("schools").delete().eq("id", id);
    if (deleteError) {
      setError("Could not delete school. It may have existing enrollment reports.");
      return;
    }
    setSchools((prev) => prev.filter((s) => s.id !== id));
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-brand-900">All Schools ({schools.length})</p>
          <Input
            placeholder="Search by name or EMIS code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs py-2"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="🏫" title="No schools found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-gray-500">
                  <th className="py-2 pr-2">School Name</th>
                  <th className="py-2 pr-2">EMIS Code</th>
                  <th className="py-2 pr-2">Tehsil</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-brand-50">
                    <td className="py-2 pr-2 font-medium text-brand-900">{s.school_name}</td>
                    <td className="py-2 pr-2 text-gray-600">{s.emis_code}</td>
                    <td className="py-2 pr-2 text-gray-600">{s.tehsil}</td>
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
