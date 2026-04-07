import { countHoursLogsByContentHash } from "@/lib/hours/hours-log-content-hash";
import {
  BBS_UPLOADS_BUCKET,
  type BbsScanExtractedEntry,
} from "@/lib/mobile/bbs-scan-types";
import { normalizeLicenseTrack } from "@/lib/licensing/license-tracks";
import { extractBbsRowsFromScanImage } from "@/lib/openai/bbs-scan-extract";
import { sha256HexBuffer } from "@/lib/server/sha256-buffer";
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

/**
 * Core scan pipeline (storage + duplicate check + OpenAI + signed preview URL).
 * Used by the Server Action and the `/api/bbs-scan/extract` route so mobile
 * can use a plain JSON HTTP handler when Server Actions fail at the framework layer.
 */
export async function extractBbsScanFromStorageCore(
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

  let licenseTrack = normalizeLicenseTrack(null);
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("license_track")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileErr && profileRow) {
    licenseTrack = normalizeLicenseTrack(profileRow.license_track);
  }

  if (!options?.confirmDuplicate) {
    const { count, error: cntErr } = await countHoursLogsByContentHash(
      supabase,
      user.id,
      contentHash,
    );
    if (cntErr) {
      if (
        /source_content_hash|column .* does not exist|42703/i.test(cntErr)
      ) {
        return {
          ok: false,
          message:
            "Database is missing hours_logs.source_content_hash. Apply supabase/migrations/20260416120000_hours_logs_content_hash.sql (or run: npm run db:content-hash) on this Supabase project, then try again.",
        };
      }
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
    entries = await extractBbsRowsFromScanImage({
      base64,
      mimeType: mime,
      licenseTrack,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Vision extraction failed.";
    if (/timeout|timed out|ETIMEDOUT|aborted/i.test(raw)) {
      return {
        ok: false,
        message:
          "Reading the photo timed out. Try a smaller or clearer image, or check your connection.",
      };
    }
    return { ok: false, message: raw };
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
