import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/Header";
import { AdminNav } from "@/components/AdminNav";
import { UsersManager } from "./UsersManager";

export default async function AdminUsersPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: profiles }, { data: schools }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("schools").select("*").order("school_name"),
  ]);

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="User Management" homeHref="/admin" />
      <AdminNav />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <UsersManager initialUsers={profiles ?? []} schools={schools ?? []} />
      </div>
    </main>
  );
}
