/**
 * Runs once when the Node server starts — helpful for local env debugging.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export function register(): void {
  const ok = Boolean(process.env["OPENAI_API_KEY"]?.trim());
  if (ok) return;

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[License FYI] OPENAI_API_KEY is missing from process.env — add it to .env.local and restart `npm run dev`.",
    );
    return;
  }

  console.warn(
    "[License FYI] OPENAI_API_KEY is missing in production — Vercel: Project Settings → Environment Variables → add for Production, then Redeploy.",
  );
}
