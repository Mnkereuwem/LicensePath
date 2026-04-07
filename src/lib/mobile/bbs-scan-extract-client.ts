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
