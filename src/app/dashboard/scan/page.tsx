import { BbsScanClient } from "@/app/dashboard/scan/bbs-scan-client";

/* GPT-4o vision can exceed 60s on large images; keep users under one warm request */
export const maxDuration = 180;
export const runtime = "nodejs";

export default function BbsScanPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Scan weekly log
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Choose your credential under Settings so the AI reader matches your
          state’s typical hour logs. Review and confirm before records are
          added.
        </p>
      </div>
      <BbsScanClient />
    </div>
  );
}
