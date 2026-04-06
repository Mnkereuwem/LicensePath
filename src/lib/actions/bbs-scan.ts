"use server";

import { revalidatePath } from "next/cache";

import { addParsedBbsEntriesToWeeklyGrid } from "@/lib/actions/hours";
import { BBS_DAILY_CLINICAL_HOURS_MAX } from "@/lib/compliance/bbs-rules";
import { countHoursLogsByContentHash } from "@/lib/hours/hours-log-content-hash";
import {
  BBS_UPLOADS_BUCKET,
  type BbsScanConfirmRowInput,
  type BbsScanExtractedEntry,
} from "@/lib/mobile/bbs-scan-types";
import { extractBbsRowsFromScanImage } from "@/lib/openai/bbs-scan-extract";
import type { ParsedBbsEntry } from "@/lib/openai/bbs-ocr";
import { sha256HexBuffer } from "@/lib/server/sha256-buffer";
import { ensureProfileForUser } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const DUPLICATE_SCAN_DOCUMENT_CODE = "duplicate_document" as const;

export type ExtractBbsScanResult =
  | {
      ok: true;
      entries: BbsScanExtractedEntry[];
      previewSignedUrl: string;
      contentHash: string;
    }
  | { ok: false; message: string }
  | {
      ok: false;
      code: typeof DUPLICATE_SCAN_DOCUMENT_CODE;
      message: string;
      priorLineCount: number;
      contentHash: string;
    };

function assertOwnPath(userId: string, storagePath: string): boolean {
  const first = storagePath.split("/")[0];
  return Boolean(first && first === userId);
}

function mimeFromPath(path: string): "image/jpeg" | "image/png" | "image/webp" {
  const low = path.toLowerCase();
  if (low.endsWith(".png")) return "image/png";
  if (low.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function extractBbsScanFromStorage(
  storagePath: string,
  options?: { confirmDuplicate?: boolean },
): Promise<ExtractBbsScanResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }
  if (!assertOwnPath(user.id, storagePath)) {
    return { ok: false, message: "Invalid storage path." };
  }

  const { data: file, error: dlErr } = await supabase.storage
    .from(BBS_UPLOADS_BUCKET)
    .download(storagePath);

  if (dlErr || !file) {
    return {
      ok: false,
      message: dlErr?.message ?? "Could not download scan from storage.",
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const contentHash = sha256HexBuffer(buf);

  if (!options?.confirmDuplicate) {
    const { count, error: cntErr } = await countHoursLogsByContentHash(
      supabase,
      user.id,
      contentHash,
    );
    if (cntErr) {
      return { ok: false, message: cntErr };
    }
    if (count > 0) {
      return {
        ok: false,
        code: DUPLICATE_SCAN_DOCUMENT_CODE,
        contentHash,
        priorLineCount: count,
        message: `This exact image was already processed (${count} saved line(s)). Reading it again would duplicate hours. Continue only if you intend to add another copy.`,
      };
    }
  }

  const mime = mimeFromPath(storagePath);
  const base64 = buf.toString("base64");

  let entries: BbsScanExtractedEntry[];
  try {
    entries = await extractBbsRowsFromScanImage({ base64, mimeType: mime });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Vision extraction failed.";
    return { ok: false, message: msg };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BBS_UPLOADS_BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (signErr || !signed?.signedUrl) {
    return {
      ok: false,
      message: signErr?.message ?? "Could not create preview URL.",
    };
  }

  return {
    ok: true,
    entries,
    previewSignedUrl: signed.signedUrl,
    contentHash,
  };
}

export async function confirmBbsScanAndSave(input: {
  storagePath: string;
  rows: BbsScanConfirmRowInput[];
  fileNameHint?: string;
  contentHash: string;
}): Promise<
  { ok: true; inserted: number; weeksUpdated: string[] } | { ok: false; message: string }
> {
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

  for (const r of input.rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.work_date)) {
      return { ok: false, message: `Invalid date: ${r.work_date}` };
    }
    if (r.direct_clinical_counseling_hours > BBS_DAILY_CLINICAL_HOURS_MAX) {
      return {
        ok: false,
        message: `Direct clinical hours on ${r.work_date} exceed the daily guardrail (${BBS_DAILY_CLINICAL_HOURS_MAX}h). Reduce the value or split across days.`,
      };
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  let organizationId = profile?.organization_id ?? null;
  if (!organizationId) {
    const fixed = await ensureProfileForUser(user);
    if (!fixed.ok) {
      return { ok: false, message: fixed.message };
    }
    organizationId = fixed.organizationId;
  }

  const parsedForGrid: ParsedBbsEntry[] = input.rows.map((r) => ({
    date: r.work_date,
    clinical_hours: Math.max(0, r.direct_clinical_counseling_hours),
    individual_supervision_hours: 0,
    group_supervision_hours: Math.max(0, r.non_clinical_supervision_hours),
    site_name: r.supervised_site_name,
  }));

  const ocrRawFirst = JSON.parse(
    JSON.stringify({
      model: "gpt-4o",
      source: "mobile_scan",
      contentHash: input.contentHash,
      fileName: input.fileNameHint ?? input.storagePath,
      rows: input.rows,
    }),
  ) as Record<string, unknown>;

  const dbRows = input.rows.map((r, i) => ({
    organization_id: organizationId,
    supervisee_id: user.id,
    work_date: r.work_date,
    site_name: r.supervised_site_name,
    individual_supervision_hours: 0,
    group_supervision_hours: Math.max(0, r.non_clinical_supervision_hours),
    clinical_hours: Math.max(0, r.direct_clinical_counseling_hours),
    source_storage_path: input.storagePath,
    source_content_hash: input.contentHash,
    ocr_raw: i === 0 ? ocrRawFirst : null,
  }));

  const { error: insErr } = await supabase.from("hours_logs").insert(dbRows);
  if (insErr) {
    return {
      ok: false,
      message: insErr.message.includes("source_content_hash")
        ? `${insErr.message} Apply migration supabase/migrations/20260416120000_hours_logs_content_hash.sql (or npm run db:content-hash).`
        : insErr.message,
    };
  }

  const grid = await addParsedBbsEntriesToWeeklyGrid(parsedForGrid);
  if (!grid.ok) {
    return {
      ok: false,
      message: `${grid.message} (Rows may be in hours_logs without weekly grid updates.)`,
    };
  }

  revalidatePath("/dashboard/hours");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/scan");

  return {
    ok: true,
    inserted: dbRows.length,
    weeksUpdated: grid.weeksTouched,
  };
}
