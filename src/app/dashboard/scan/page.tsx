import { BbsScanClient } from "@/app/dashboard/scan/bbs-scan-client";

export const maxDuration = 60;
export const runtime = "nodejs";

export default function BbsScanPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Scan weekly log
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          LicensePath · mobile-optimized capture. Review and confirm before
          records are added.
        </p>
      </div>
      <BbsScanClient />
    </div>
  );
}
