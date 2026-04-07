"use server";

import type { BbsScanConfirmRowInput } from "@/lib/mobile/bbs-scan-types";
import {
  confirmBbsScanAndSaveCore,
  type ConfirmBbsScanResult,
} from "@/lib/server/bbs-scan-confirm-storage";
import {
  extractBbsScanFromStorageCore,
  type ExtractBbsScanResult,
} from "@/lib/server/bbs-scan-extract-storage";

export type { ConfirmBbsScanResult, ExtractBbsScanResult };

export async function extractBbsScanFromStorage(
  storagePath: string,
  options?: { confirmDuplicate?: boolean },
): Promise<ExtractBbsScanResult> {
  try {
    return await extractBbsScanFromStorageCore(storagePath, options);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[extractBbsScanFromStorage]", raw);
    return {
      ok: false,
      message:
        "Scan could not finish on the server. If this keeps happening: run database migrations (profiles.license_track, hours_logs.source_content_hash), set OPENAI_API_KEY on your host, and ensure your plan allows long server runs (~2 min) for AI vision.",
    };
  }
}

export async function confirmBbsScanAndSave(input: {
  storagePath: string;
  rows: BbsScanConfirmRowInput[];
  fileNameHint?: string;
  contentHash: string;
}): Promise<ConfirmBbsScanResult> {
  try {
    return await confirmBbsScanAndSaveCore(input);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[confirmBbsScanAndSave]", raw);
    return {
      ok: false,
      message: "Could not save scan rows on the server. Try again in a moment.",
    };
  }
}
