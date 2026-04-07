"use server";

import { revalidatePath } from "next/cache";

import { addParsedBbsEntriesToWeeklyGrid } from "@/lib/actions/hours";
import { countHoursLogsByContentHash } from "@/lib/hours/hours-log-content-hash";
import {
  extractBbsEntriesFromPdfBuffer,
  extractBbsEntriesFromText,
  extractTextFromPdfBuffer,
  type ParsedBbsEntry,
} from "@/lib/openai/bbs-ocr";
import { BBS_DOCUMENTS_BUCKET } from "@/lib/mobile/bbs-scan-types";
import { sha256HexBuffer } from "@/lib/server/sha256-buffer";
import { normalizeLicenseTrack } from "@/lib/licensing/license-tracks";
import { ensureProfileForUser } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;

function resolvePdfMime(file: File, buf: Buffer): string {
  const t = (file.type || "").toLowerCase().trim();
  if (t === "application/pdf") return t;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return t || "application/octet-stream";
}

function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
}

export type UploadBbsDocumentResult =
  | {
      ok: true;
      inserted: number;
      storagePath: string;
      weeksUpdated: string[];
    }
  | { ok: false; message: string }
  | {
      ok: false;
      duplicateDocument: true;
      message: string;
      priorLineCount: number;
    };

export async function uploadBbsDocumentAndExtract(
  formData: FormData,
): Promise<UploadBbsDocumentResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "No file uploaded." };
  }

  if (file.size > MAX_BYTES) {
    return { ok: false, message: "File must be 10MB or smaller." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = resolvePdfMime(file, buf).toLowerCase();
  if (mime !== "application/pdf") {
    return {
      ok: false,
      message:
        "Only PDF files are supported. Export or save your BBS log as a PDF, then upload it here. (Photos and scans must be saved as PDF first.)",
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  const contentHash = sha256HexBuffer(buf);
  const confirmDuplicate = formData.get("confirmDuplicate") === "1";

  if (!confirmDuplicate) {
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
        duplicateDocument: true,
        priorLineCount: count,
        message: `This exact PDF was already imported (${count} saved line(s) from a prior upload). Processing again would duplicate hours in your weekly log. Continue only if you mean to add another copy.`,
      };
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, license_track")
    .eq("id", user.id)
    .maybeSingle();

  const licenseTrack = normalizeLicenseTrack(profile?.license_track);

  let organizationId = profile?.organization_id ?? null;
  if (!organizationId) {
    const fixed = await ensureProfileForUser(user);
    if (!fixed.ok) {
      return { ok: false, message: fixed.message };
    }
    organizationId = fixed.organizationId;
  }

  const storagePath = `${user.id}/${Date.now()}_${safeFileName(file.name)}`;

  const { error: upErr } = await supabase.storage
    .from(BBS_DOCUMENTS_BUCKET)
    .upload(storagePath, buf, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (upErr) {
    return {
      ok: false,
      message: upErr.message.includes("Bucket not found")
        ? "Storage bucket missing. Run: npm run db:bbs-storage (or apply the hours_logs migration in Supabase)."
        : upErr.message,
    };
  }

  let entries: ParsedBbsEntry[] = [];
  try {
    const text = await extractTextFromPdfBuffer(buf);
    if (text.length >= 40) {
      entries = await extractBbsEntriesFromText(text, licenseTrack);
    }
    if (!entries.length) {
      entries = await extractBbsEntriesFromPdfBuffer(
        buf,
        file.name,
        licenseTrack,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OCR failed.";
    const slow =
      /timeout|TIMEOUT|504|deadline|aborted|ECONNRESET|fetch failed/i.test(
        msg,
      );
    const hint = slow
      ? " On Vercel, OCR needs a long serverless run: use a Pro plan (or higher) so maxDuration 60s applies; Hobby is limited to 10s."
      : "";
    return { ok: false, message: `${msg}${hint}` };
  }

  if (!entries.length) {
    return {
      ok: false,
      message:
        "No hour rows were extracted from this PDF. Use a filled BBS log with visible “Week of” dates and hours, or a clearer export.",
    };
  }

  const ocrRawFirst = JSON.parse(
    JSON.stringify({
      model: "gpt-4o",
      fileName: file.name,
      contentHash,
      licenseTrack,
      entries,
    }),
  ) as Record<string, unknown>;

  const rows = entries.map((e, i) => ({
    organization_id: organizationId,
    supervisee_id: user.id,
    work_date: e.date,
    site_name: e.site_name,
    individual_supervision_hours: e.individual_supervision_hours,
    group_supervision_hours: e.group_supervision_hours,
    clinical_hours: e.clinical_hours,
    source_storage_path: storagePath,
    source_content_hash: contentHash,
    ocr_raw: i === 0 ? ocrRawFirst : null,
  }));

  const { error: insErr } = await supabase.from("hours_logs").insert(rows);

  if (insErr) {
    return {
      ok: false,
      message: insErr.message.includes("source_content_hash")
        ? `${insErr.message} Apply migration supabase/migrations/20260416120000_hours_logs_content_hash.sql (or npm run db:content-hash).`
        : insErr.message,
    };
  }

  const grid = await addParsedBbsEntriesToWeeklyGrid(entries);
  if (!grid.ok) {
    return {
      ok: false,
      message: `${grid.message} (OCR rows are in hours_logs; weekly grid was not updated.)`,
    };
  }

  revalidatePath("/dashboard/hours");
  revalidatePath("/dashboard");

  return {
    ok: true,
    inserted: rows.length,
    storagePath,
    weeksUpdated: grid.weeksTouched,
  };
}
