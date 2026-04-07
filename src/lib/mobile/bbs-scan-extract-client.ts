import type { BbsScanConfirmRowInput } from "@/lib/mobile/bbs-scan-types";
import type { ConfirmBbsScanResult } from "@/lib/server/bbs-scan-confirm-storage";
import type { ExtractBbsScanResult } from "@/lib/server/bbs-scan-extract-storage";

/**
 * Call the JSON extract API (same logic as the Server Action, avoids flaky action transport on mobile).
 */
export async function extractBbsScanFromStorageRequest(
  storagePath: string,
  options?: { confirmDuplicate?: boolean },
): Promise<ExtractBbsScanResult> {
  const res = await fetch("/api/bbs-scan/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      storagePath,
      confirmDuplicate: options?.confirmDuplicate ?? false,
    }),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return {
      ok: false,
      message: text.slice(0, 240) || `HTTP ${res.status}`,
    };
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "ok" in (parsed as object)
  ) {
    return parsed as ExtractBbsScanResult;
  }

  return {
    ok: false,
    message: "Unexpected response from scan service.",
  };
}

export async function confirmBbsScanRequest(input: {
  storagePath: string;
  contentHash: string;
  rows: BbsScanConfirmRowInput[];
  fileNameHint?: string;
}): Promise<ConfirmBbsScanResult> {
  const res = await fetch("/api/bbs-scan/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return {
      ok: false,
      message: text.slice(0, 240) || `HTTP ${res.status}`,
    };
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "ok" in (parsed as object)
  ) {
    return parsed as ConfirmBbsScanResult;
  }

  return {
    ok: false,
    message: "Unexpected response from scan save service.",
  };
}
