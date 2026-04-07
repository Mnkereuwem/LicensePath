/**
 * Flatten server action / fetch errors so production Next.js "digest" text
 * still matches our friendly_patterns.
 */
export function flattenScanError(messageOrError: string | unknown): string {
  const parts: string[] = [];
  const seen = new WeakSet<object>();

  function walk(x: unknown): void {
    if (x == null) return;
    if (typeof x === "string") {
      parts.push(x);
      return;
    }
    if (typeof x === "number" || typeof x === "boolean") {
      parts.push(String(x));
      return;
    }
    if (x instanceof Error) {
      parts.push(x.message);
      if (x.cause !== undefined) walk(x.cause);
      return;
    }
    if (typeof x === "object") {
      const o = x as object;
      if (seen.has(o)) return;
      seen.add(o);
      const rec = x as Record<string, unknown>;
      if (typeof rec.message === "string") parts.push(rec.message);
      if (typeof rec.description === "string") parts.push(rec.description);
      if (typeof rec.digest === "string") parts.push(`digest ${rec.digest}`);
      if (typeof rec.status === "number") parts.push(`status ${rec.status}`);
      if (rec.cause !== undefined) walk(rec.cause);
    }
  }

  walk(messageOrError);
  const s = parts.join(" ").replace(/\s+/g, " ").trim();
  return s || "Something went wrong.";
}

/** User-visible copy when the platform hides the real server error. */
export function describeScanFailure(messageOrError: string | unknown): string {
  const flat = flattenScanError(messageOrError);
  if (
    /Server Components render|omitted in production|sensitive details|\bdigest\b/i.test(
      flat,
    ) ||
    /Execution timed out|FUNCTION_INVOCATION_TIMEOUT|\b504\b/i.test(flat) ||
    /unexpected response was received from the server/i.test(flat)
  ) {
    return "The server stopped this scan (timeout or deploy). Redeploy the app, run Supabase migrations (profiles.license_track + hours_logs.source_content_hash), set OPENAI_API_KEY on the host, and use a plan that allows ~2–3 minute API routes.";
  }
  if (/ECONNRESET|ETIMEDOUT|Failed to fetch|NetworkError|load failed/i.test(flat)) {
    return "Network error—check your connection and try again.";
  }
  if (/413|Payload Too Large|body.*limit|request body.*too large/i.test(flat)) {
    return "Photo or request too large. Try a smaller image.";
  }
  return flat;
}
