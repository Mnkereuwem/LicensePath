import { Calculator } from "lucide-react";

import {
  DEFAULT_EXPERIENCE_YEAR,
} from "@/lib/compliance/bbs-rules";
import {
  formatSupervisionGateShort,
  getTrackHourRules,
} from "@/lib/compliance/track-hour-rules";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LICENSE_TRACK_IDS,
  LICENSE_TRACK_OPTIONS,
  normalizeLicenseTrack,
} from "@/lib/licensing/license-tracks";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Upload math | LicensePath",
  description:
    "Per-track caps, targets, and supervision rules for PDF and photo imports.",
};

export default async function UploadCalculationsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const track = user
    ? normalizeLicenseTrack(
        (
          await supabase
            .from("profiles")
            .select("license_track")
            .eq("id", user.id)
            .maybeSingle()
        ).data?.license_track,
      )
    : "ca_asw";
  const rules = getTrackHourRules(track);
  const trackLabel =
    LICENSE_TRACK_OPTIONS.find((o) => o.id === track)?.label ?? track;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary ring-primary/15 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Calculator className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Upload math
          </h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed sm:text-base">
            How PDF and photo imports become rows and credited weekly totals. Caps
            and dashboard targets follow your{" "}
            <span className="text-foreground font-medium">
              license track in Settings
            </span>
            . The table below lists every track’s guardrails in one place.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Track rules table</CardTitle>
          <CardDescription>
            Values the app uses for weekly credit caps, scan day limits, dashboard
            progress targets, and supervision checks. Product guardrails—not legal
            advice; verify with your board.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-2.5 pr-2 font-medium">Track</th>
                <th className="py-2.5 px-1 font-medium tabular-nums" title="Weekly credited cap (all categories)">
                  Wk cap
                </th>
                <th className="py-2.5 px-1 font-medium tabular-nums" title="Daily direct clinical guardrail on scans">
                  Day*
                </th>
                <th className="py-2.5 px-1 font-medium tabular-nums" title="Total hours target (dashboard)">
                  Target
                </th>
                <th className="py-2.5 px-1 font-medium tabular-nums" title="Direct clinical minimum (planning)">
                  Clin min
                </th>
                <th className="py-2.5 px-1 font-medium tabular-nums" title="Face-to-face minimum (planning)">
                  F2F min
                </th>
                <th className="py-2.5 px-1 font-medium tabular-nums" title="Non-clinical maximum (planning)">
                  NC max
                </th>
                <th className="py-2.5 px-1 font-medium tabular-nums" title="Experience clock window (years)">
                  Yrs
                </th>
                <th className="py-2.5 pl-1 font-medium">Supervision†</th>
              </tr>
            </thead>
            <tbody>
              {LICENSE_TRACK_IDS.map((id) => {
                const r = getTrackHourRules(id);
                const lab =
                  LICENSE_TRACK_OPTIONS.find((o) => o.id === id)?.label ?? id;
                const isYou = id === track;
                return (
                  <tr
                    key={id}
                    className={
                      isYou
                        ? "bg-primary/8 border-border/60 border-b"
                        : "border-border/60 border-b"
                    }
                  >
                    <td className="text-foreground py-2 pr-2">
                      {lab}
                      {isYou ? (
                        <span className="text-primary ml-1.5 text-xs font-medium">
                          (you)
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular-nums px-1 py-2">
                      {r.weeklyCreditMaxPerWeek}h
                    </td>
                    <td className="tabular-nums px-1 py-2">
                      {r.dailyClinicalHoursMax}h
                    </td>
                    <td className="tabular-nums px-1 py-2">
                      {r.totalHoursTarget.toLocaleString()}
                    </td>
                    <td className="tabular-nums px-1 py-2">
                      {r.directClinicalMin.toLocaleString()}
                    </td>
                    <td className="tabular-nums px-1 py-2">
                      {r.faceToFaceMin.toLocaleString()}
                    </td>
                    <td className="tabular-nums px-1 py-2">
                      {r.nonClinicalMax.toLocaleString()}
                    </td>
                    <td className="tabular-nums px-1 py-2">{r.sunsetYears}</td>
                    <td className="text-muted-foreground max-w-[14rem] py-2 pl-1 text-xs leading-snug">
                      {formatSupervisionGateShort(r.weeklySupervisionGate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-muted-foreground mt-3 space-y-1 text-xs leading-relaxed">
            <p>
              *<span className="font-medium">Day</span> — per-date direct clinical
              limit for photo scans (model cap + save validation).
            </p>
            <p>
              †<span className="font-medium">Supervision</span> — expectation for
              weeks where you report clinical hours (individual / group buckets on
              the grid); see dashboard “This week” card for your status.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Your track (Settings)</CardTitle>
          <CardDescription>{trackLabel}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm leading-relaxed">
          <p>
            <span className="text-foreground font-medium">Weekly credit cap:</span>{" "}
            {rules.weeklyCreditMaxPerWeek}h combined across categories (credited
            hours).
          </p>
          <p>
            <span className="text-foreground font-medium">
              Daily direct clinical guardrail (scans):
            </span>{" "}
            {rules.dailyClinicalHoursMax}h per date row before save is blocked or
            model-capped.
          </p>
          <p>
            <span className="text-foreground font-medium">
              Progress target (dashboard):
            </span>{" "}
            {rules.totalHoursTarget.toLocaleString()}h total experience planning
            figure for this track.
          </p>
          <p className="text-foreground/90">{rules.rulesBlurb}</p>
        </CardContent>
      </Card>

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
            You choose a PDF; the server extracts rows with GPT-4o (prompt tuned
            to your track) and saves them after upload. There is a confirmation
            step in the UI only when the file matches a prior upload (see
            duplicates below).
          </p>
          <p>
            <span className="text-foreground font-medium">Scan log (photo).</span>{" "}
            You take or pick an image; it is stored privately, then GPT-4o vision
            reads it using your track. You review and edit extracted fields, then
            save inserts rows.
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
            For each week (Monday start), categories have a{" "}
            <span className="text-foreground font-medium">reported</span> total
            that is the sum of what you typed or imported.{" "}
            <span className="text-foreground font-medium">Credited</span> hours
            may be lower when the weekly cap for your track applies.
          </p>
          <p>
            Dashboard rollups use <span className="text-foreground font-medium">credited</span>{" "}
            totals across weeks. The current-week card may show both the capped
            total and “reported before cap” when they differ.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly credit cap</CardTitle>
          <CardDescription>
            Your cap is {rules.weeklyCreditMaxPerWeek}h (see table above for other
            tracks).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            For each week, the{" "}
            <span className="text-foreground font-medium">
              sum of all categories together
            </span>{" "}
            is limited to your track’s weekly maximum when we compute{" "}
            <span className="text-foreground font-medium">credited</span> hours.
            If imports push that week above the cap, credited amounts are scaled
            down proportionally so they add up to the cap.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Daily direct clinical guardrail (scans)
          </CardTitle>
          <CardDescription>
            Your track uses {rules.dailyClinicalHoursMax}h per day for this check.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            On each date row from a scan, direct clinical counseling hours above
            your track’s daily limit are rejected on save or capped during model
            cleanup; you can edit before save.
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
            get a warning before OCR or vision runs again.
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
            After an import, we verify that each week’s bucketed totals match the
            sum of the rows we are adding. If they diverge, the update is blocked.
          </p>
        </CardContent>
      </Card>

      <p className="text-muted-foreground border-border text-xs leading-relaxed">
        These rules are software guardrails for tracking. Your board packet and
        employer requirements may differ; confirm figures on your official weekly
        log and with your supervisor or board counsel.
      </p>
    </div>
  );
}
