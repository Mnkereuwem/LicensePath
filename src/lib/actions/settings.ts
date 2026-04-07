"use server";

import { revalidatePath } from "next/cache";

import {
  isLicenseTrackId,
  LICENSE_TRACK_IDS,
} from "@/lib/licensing/license-tracks";
import { ensureProfileForUser } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateSuperviseeSettings(formData: FormData): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const regRaw = String(formData.get("bbs_registration_at") ?? "").trim();
  const licenseRaw = String(formData.get("license_track") ?? "").trim();

  if (!isLicenseTrackId(licenseRaw)) {
    return {
      ok: false,
      message: `Choose a valid license track (${LICENSE_TRACK_IDS.join(", ")}).`,
    };
  }

  if (!regRaw || !/^\d{4}-\d{2}-\d{2}$/.test(regRaw)) {
    return { ok: false, message: "Registration date must be YYYY-MM-DD." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const fixed = await ensureProfileForUser(user);
    if (!fixed.ok) {
      return { ok: false, message: fixed.message };
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      license_track: licenseRaw,
    })
    .eq("id", user.id);

  if (profileError) {
    return { ok: false, message: profileError.message };
  }

  const { error: clockError } = await supabase
    .from("supervisee_license_clocks")
    .upsert(
      { profile_id: user.id, bbs_registration_at: regRaw },
      { onConflict: "profile_id" },
    );

  if (clockError) {
    return { ok: false, message: clockError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
