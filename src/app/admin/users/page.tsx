import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSchools } from "@/lib/services/schools";
import type { School } from "@/lib/types";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { UsersManager } from "./UsersManager";

export default async function AdminUsersPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  let schools: School[] = [];
  let schoolsError: string | null = null;
  try {
    schools = await getSchools(supabase);
  } catch {
    schoolsError = "Could not load the schools list. Please refresh the page or try again shortly.";
  }

  const { data: profiles } = await supabase.from("profiles").select("*").order("full_name");

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="User Management" homeHref="/admin" />
      <AdminNav />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <UsersManager initialUsers={profiles ?? []} schools={schools} schoolsError={schoolsError} />
      </div>
    </main>
  );
}
