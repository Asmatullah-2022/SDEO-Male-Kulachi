"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearAllCache } from "@/lib/adminCache";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Wipes this tab's cached profile/school/reports — without this, the
    // next account to sign in on this device would see this account's
    // cached dashboard data until a hard refresh. See adminCache.ts.
    clearAllCache();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
    >
      {loading ? "..." : "Sign out"}
    </button>
  );
}
