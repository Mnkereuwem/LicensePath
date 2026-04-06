import { Calculator } from "lucide-react";

import {
  BBS_DAILY_CLINICAL_HOURS_MAX,
  DEFAULT_EXPERIENCE_YEAR,
  WEEKLY_CREDIT_CAP,
} from "@/lib/compliance/bbs-rules";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "How uploads calculate hours | LicensePath",
  description:
    "Rules for PDF and photo imports: weekly caps, daily limits, duplicates, and credited vs reported time.",
};

export default function UploadCalculationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary ring-primary/15 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Calculator className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            How uploads calculate hours
          </h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed sm:text-base">
            LicensePath turns BBS-style logs into database rows and weekly
            totals. Here is what happens after you upload a PDF or scan a photo,
            before anything reaches your board packet.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Two import paths</CardTitle>
          <CardDescription>
            Same end state: lines in{" "}
            <span className="text-foreground font-medium">hours_logs</span> and
            updates to your weekly hour grid.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            <span className="text-foreground font-medium">Log hours (PDF).</span>{" "}
            You choose a PDF; the server extracts rows with GPT-4o and saves
            them after upload. There is a confirmation step in the UI only when
            the file matches a prior upload (see duplicates below).
          </p>
          <p>
            <span className="text-foreground font-medium">Scan log (photo).</span>{" "}
            You take or pick an image; it is stored privately, then GPT-4o
            vision reads it. You review and edit extracted fields, then{" "}
            <span className="text-foreground font-medium">Confirm and save</span>{" "}
            inserts rows. Nothing is written to{" "}
            <span className="text-foreground font-medium">hours_logs</span> until
            you confirm.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reported vs credited hours</CardTitle>
          <CardDescription>
            Your weekly grid stores both raw and capped values.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            For each week (Monday start), categories like direct clinical,
            supervision, etc. have a{" "}
            <span className="text-foreground font-medium">reported</span> total
            that is the sum of what you typed or imported. Separately,{" "}
            <span className="text-foreground font-medium">credited</span> hours
            may be lower when the weekly rule below applies.
          </p>
          <p>
            Dashboard rollups that describe progress toward BBS targets usually
            use <span className="text-foreground font-medium">credited</span>{" "}
            totals across weeks. The current-week card may show both the capped
            total and “reported before cap” when they differ.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Weekly credit cap ({WEEKLY_CREDIT_CAP}h)
          </CardTitle>
          <CardDescription>
            Aligned with the usual ASW weekly log ceiling; applies per calendar
            week.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            For each week, the{" "}
            <span className="text-foreground font-medium">
              sum of all categories together
            </span>{" "}
            (clinical, face-to-face, non-clinical, individual and group
            supervision, other) is limited to{" "}
            <span className="text-foreground font-medium tabular-nums">
              {WEEKLY_CREDIT_CAP} hours
            </span>{" "}
            when we compute{" "}
            <span className="text-foreground font-medium">credited</span>{" "}
            hours. If imports push that week above {WEEKLY_CREDIT_CAP} total,
            credited amounts are{" "}
            <span className="text-foreground font-medium">
              scaled down proportionally
            </span>{" "}
            so the credited pieces still add up to {WEEKLY_CREDIT_CAP} for that
            week.
          </p>
          <p>
            Importing the{" "}
            <span className="text-foreground font-medium">same file twice</span>{" "}
            stacks raw hours again. That can trigger the cap even when a single
            pass looked fine, so{" "}
            <span className="text-foreground font-medium">
              credited totals will not simply double
            </span>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Daily direct clinical guardrail ({BBS_DAILY_CLINICAL_HOURS_MAX}h)
          </CardTitle>
          <CardDescription>Used when reviewing photo scans.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            On each date row from a{" "}
            <span className="text-foreground font-medium">scan</span>, direct
            clinical counseling hours are not accepted above{" "}
            <span className="text-foreground font-medium tabular-nums">
              {BBS_DAILY_CLINICAL_HOURS_MAX} hours
            </span>{" "}
            per day without correction. The model may cap high reads; you can
            edit before save.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Duplicate uploads</CardTitle>
          <CardDescription>Same bytes as an earlier import.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            We fingerprint each PDF or scan image (SHA-256). If that exact file
            was already saved to your{" "}
            <span className="text-foreground font-medium">hours_logs</span>, you
            get a warning before OCR or vision runs again. You can still
            proceed, but that usually means duplicating hours—only do it on
            purpose.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dates without a year</CardTitle>
          <CardDescription>Mostly affects photo extraction.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm leading-relaxed">
          <p>
            When the model cannot see a year on the form, it assumes{" "}
            <span className="text-foreground font-medium tabular-nums">
              {DEFAULT_EXPERIENCE_YEAR}
            </span>{" "}
            for normalization. Always check dates on the review screen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Totals check on import</CardTitle>
          <CardDescription>Safety check when building weekly deltas.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            After an import, we verify that each week’s bucketed totals match
            the sum of the rows we are adding. If they diverge, the update is
            blocked so bad aggregation does not silently change your grid.
          </p>
          <p>
            Multiple rows for the{" "}
            <span className="text-foreground font-medium">same date</span> add
            together in the weekly grid. The scan review screen warns when more
            than one row shares a service date.
          </p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground border-border text-xs leading-relaxed">
        These rules are software guardrails for tracking. Your BBS packet and
        employer requirements may differ; confirm figures on your official weekly
        log and with your supervisor or board counsel.
      </p>
    </div>
  );
}
