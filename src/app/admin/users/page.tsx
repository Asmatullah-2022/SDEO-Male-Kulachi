import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSchools } from "@/lib/services/schools";
import { getUsersWithEmail } from "@/lib/services/users";
import type { HeadteacherUser, School } from "@/lib/types";
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

  let users: HeadteacherUser[] = [];
  let usersError: string | null = null;
  try {
    users = await getUsersWithEmail(supabase, createAdminClient());
  } catch {
    usersError = "Could not load the user list. Please refresh the page or try again shortly.";
  }

  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <Header title="SDEO Kulachi Admin" subtitle="User Management" homeHref="/admin" />
      <AdminNav />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <UsersManager
          initialUsers={users}
          schools={schools}
          initialError={usersError ?? schoolsError}
        />
      </div>
    </main>
  );
}
