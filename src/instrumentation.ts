/**
 * Runs once when the Node server starts — helpful for local env debugging.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export function register(): void {
  if (process.env.NODE_ENV !== "production") {
    const ok = Boolean(process.env["OPENAI_API_KEY"]?.trim());
    if (!ok) {
      console.warn(
        "[License FYI] OPENAI_API_KEY is missing from process.env — add it to .env.local and restart `npm run dev`.",
      );
    }
  }
}
