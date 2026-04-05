import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const labelFallback = user?.email?.split("@")[0] ?? "Account";
  let userLabel = labelFallback;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.full_name?.trim()) {
      userLabel = profile.full_name.trim();
    }
  }

  return (
    <DashboardShell userLabel={userLabel} userEmail={user?.email ?? ""}>
      {children}
    </DashboardShell>
  );
}
