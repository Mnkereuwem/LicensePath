import { SettingsForm } from "@/components/dashboard/settings-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: clock }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("supervisee_license_clocks")
      .select("bbs_registration_at")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  const reg =
    clock?.bbs_registration_at ??
    new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Name and BBS ASW registration date feed your dashboard countdown and
          exports later on.
        </p>
      </div>
      <SettingsForm
        fullName={profile?.full_name ?? ""}
        bbsRegistrationAt={reg}
        email={user.email ?? ""}
      />
    </div>
  );
}
