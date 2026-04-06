import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { MobileAppLayout } from "@/components/mobile/mobile-app-layout";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
/** BBS upload runs long OpenAI calls; required on Vercel Pro (Hobby max is 10s). */
export const maxDuration = 60;
export const runtime = "nodejs";

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
      <MobileAppLayout>{children}</MobileAppLayout>
    </DashboardShell>
  );
}
