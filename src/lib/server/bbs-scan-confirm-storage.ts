import { revalidatePath } from "next/cache";

import {
  addParsedBbsEntriesToWeeklyGrid,
  subtractParsedBbsEntriesFromWeeklyGrid,
} from "@/lib/actions/hours";
import { getTrackHourRules } from "@/lib/compliance/track-hour-rules";
import {
  BBS_UPLOADS_BUCKET,
  type BbsScanConfirmRowInput,
} from "@/lib/mobile/bbs-scan-types";
import { normalizeLicenseTrack } from "@/lib/licensing/license-tracks";
import type { ParsedBbsEntry } from "@/lib/openai/bbs-ocr";
import { sha256HexBuffer } from "@/lib/server/sha256-buffer";
import { ensureProfileForUser } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ConfirmBbsScanResult =
  | { ok: true; inserted: number; weeksUpdated: string[] }
  | { ok: false; message: string };

function assertOwnPath(userId: string, storagePath: string): boolean {
  const first = storagePath.split("/")[0];
  return Boolean(first && first === userId);
}

/** Persist scanned rows after preview (shared by Server Action and `/api/bbs-scan/confirm`). */
export async function confirmBbsScanAndSaveCore(input: {
  storagePath: string;
  rows: BbsScanConfirmRowInput[];
  fileNameHint?: string;
  contentHash: string;
}): Promise<ConfirmBbsScanResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }
  if (!assertOwnPath(user.id, input.storagePath)) {
    return { ok: false, message: "Invalid storage path." };
  }

  if (!input.rows.length) {
    return { ok: false, message: "Nothing to save." };
  }

  if (
    typeof input.contentHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.contentHash)
  ) {
    return { ok: false, message: "Missing or invalid document fingerprint." };
  }

  const { data: verifyFile, error: vErr } = await supabase.storage
    .from(BBS_UPLOADS_BUCKET)
    .download(input.storagePath);

  if (vErr || !verifyFile) {
    return {
      ok: false,
      message: vErr?.message ?? "Could not verify scan file before save.",
    };
  }
  const verifyBuf = Buffer.from(await verifyFile.arrayBuffer());
  if (sha256HexBuffer(verifyBuf) !== input.contentHash) {
    return {
      ok: false,
      message: "Scan file changed since preview. Go back and scan again.",
    };
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, license_track")
    .eq("id", user.id)
    .maybeSingle();

  let organizationId = profile?.organization_id ?? null;
  if (!organizationId) {
    const fixed = await ensureProfileForUser(user);
    if (!fixed.ok) {
      return { ok: false, message: fixed.message };
    }
    const { data: again } = await supabase
      .from("profiles")
      .select("organization_id, license_track")
      .eq("id", user.id)
      .maybeSingle();
    profile = again;
    organizationId = profile?.organization_id ?? fixed.organizationId;
  }

  if (!organizationId) {
    return { ok: false, message: "Could not resolve organization for your profile." };
  }

  const licenseTrack = normalizeLicenseTrack(profile?.license_track);
  const dailyMax = getTrackHourRules(licenseTrack).dailyClinicalHoursMax;

  for (const r of input.rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.work_date)) {
      return { ok: false, message: `Invalid date: ${r.work_date}` };
    }
    if (r.direct_clinical_counseling_hours > dailyMax) {
      return {
        ok: false,
        message: `Direct clinical hours on ${r.work_date} exceed your track’s daily guardrail (${dailyMax}h). Reduce the value or split across days.`,
      };
    }
  }

  const parsedForGrid: ParsedBbsEntry[] = input.rows.map((r) => ({
    date: r.work_date,
    clinical_hours: Math.max(0, r.direct_clinical_counseling_hours),
    individual_supervision_hours: Math.max(0, r.individual_supervision_hours),
    group_supervision_hours: Math.max(0, r.group_supervision_hours),
    site_name: r.supervised_site_name,
  }));

  const ocrRawFirst = JSON.parse(
    JSON.stringify({
      model: "gpt-4o",
      source: "mobile_scan",
      contentHash: input.contentHash,
      licenseTrack,
      fileName: input.fileNameHint ?? input.storagePath,
      rows: input.rows,
    }),
  ) as Record<string, unknown>;

  const dbRows = input.rows.map((r, i) => ({
    organization_id: organizationId,
    supervisee_id: user.id,
    work_date: r.work_date,
    site_name: r.supervised_site_name,
    individual_supervision_hours: Math.max(0, r.individual_supervision_hours),
    group_supervision_hours: Math.max(0, r.group_supervision_hours),
    clinical_hours: Math.max(0, r.direct_clinical_counseling_hours),
    source_storage_path: input.storagePath,
    source_content_hash: input.contentHash,
    ocr_raw: i === 0 ? ocrRawFirst : null,
  }));

  const grid = await addParsedBbsEntriesToWeeklyGrid(parsedForGrid);
  if (!grid.ok) {
    return { ok: false, message: grid.message };
  }

  const { error: insErr } = await supabase.from("hours_logs").insert(dbRows);
  if (insErr) {
    const rollback = await subtractParsedBbsEntriesFromWeeklyGrid(parsedForGrid);
    const rollbackNote = rollback.ok
      ? ""
      : ` Weekly totals may need manual check (${rollback.message}).`;
    return {
      ok: false,
      message: `${insErr.message.includes("source_content_hash") ? `${insErr.message} Apply migration supabase/migrations/20260416120000_hours_logs_content_hash.sql (or npm run db:content-hash).` : insErr.message}${rollbackNote}`,
    };
  }

  revalidatePath("/dashboard/hours");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/scan");
  revalidatePath("/dashboard/bbs-documentation");

  return {
    ok: true,
    inserted: dbRows.length,
    weeksUpdated: grid.weeksTouched,
  };
}
