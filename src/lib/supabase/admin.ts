import { createClient, type User } from "@supabase/supabase-js";

/** Default org id — must match supabase/migrations. */
export const LICENSEPATH_DEFAULT_ORG_ID =
  "a0000000-0000-4000-8000-000000000001";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url.length || !serviceKey.length) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates profile + clock for this user if the signup trigger never ran
 * (e.g. account existed before migrations). Requires service role on server only.
 */
export async function ensureProfileForUser(user: User): Promise<
  { ok: true; organizationId: string } | { ok: false; message: string }
> {
  try {
    const admin = createServiceRoleClient();
    const { error: orgErr } = await admin.from("organizations").upsert(
      {
        id: LICENSEPATH_DEFAULT_ORG_ID,
        name: "LicensePath default",
      },
      { onConflict: "id" },
    );
    if (orgErr) {
      return { ok: false, message: orgErr.message };
    }

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const fromMeta =
      typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
    const fullName =
      fromMeta.length > 0 ? fromMeta : user.email?.split("@")[0] ?? "User";

    let reg = new Date().toISOString().slice(0, 10);
    const regRaw =
      typeof meta?.bbs_registration_at === "string"
        ? meta.bbs_registration_at
        : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(regRaw)) {
      reg = regRaw;
    }

    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: user.id,
        organization_id: LICENSEPATH_DEFAULT_ORG_ID,
        full_name: fullName,
        role: "supervisee",
      },
      { onConflict: "id" },
    );
    if (profileErr) {
      return { ok: false, message: profileErr.message };
    }

    const { error: clockErr } = await admin.from("supervisee_license_clocks").upsert(
      {
        profile_id: user.id,
        bbs_registration_at: reg,
      },
      { onConflict: "profile_id" },
    );
    if (clockErr) {
      return { ok: false, message: clockErr.message };
    }

    const { data: row, error: verifyErr } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (verifyErr || !row?.organization_id) {
      return {
        ok: false,
        message:
          verifyErr?.message ??
          "Profile row missing after setup. Confirm SUPABASE_SERVICE_ROLE_KEY is this project’s secret (Settings → API) and schema includes public.profiles.",
      };
    }

    return { ok: true, organizationId: row.organization_id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      ok: false,
      message: `${msg} Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Secret key from Supabase → Settings → API).`,
    };
  }
}
