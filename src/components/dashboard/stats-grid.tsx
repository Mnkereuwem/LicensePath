import { CalendarClock, Target } from "lucide-react";

import {
  formatSupervisionRatioLabel,
  getWeeklySupervisionRatioStatusForTrack,
} from "@/lib/compliance/bbs-rules";
import type { DashboardModel } from "@/lib/dashboard/model";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(d);
}

export function StatsGrid({ model }: { model: DashboardModel }) {
  const { hours, week, cappedWeekTotal, sunset, targets, weeklyCreditCap } =
    model;

  const supervisionRatio = getWeeklySupervisionRatioStatusForTrack(
    {
      clinicalHours: week.clinicalHours,
      individualSupervisionHours: week.individualSupervisionHours,
      groupSupervisionHours: week.groupSupervisionHours,
    },
    model.licenseTrack,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Target className="text-primary size-5" aria-hidden />
                Progress ({targets.total.toLocaleString()}h target)
              </CardTitle>
              <CardDescription>
                <span className="text-foreground font-medium">
                  {model.licenseTrackLabel}
                </span>
                . Credited totals use categories tuned for your selected track
                (direct, face-to-face, non-clinical caps).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {hours.totalCredited.toLocaleString()}
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  / {targets.total.toLocaleString()}
                </span>
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {model.totalProgressPercent}%
              </span>
            </div>
            <Progress value={model.totalProgressPercent} className="h-2" />
          </div>
          <Separator />
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Direct clinical (min)</dt>
              <dd className="text-right font-medium tabular-nums">
                {hours.directClinicalCredited.toLocaleString()} /{" "}
                {targets.directMin.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                Face-to-face (within direct)
              </dt>
              <dd className="text-right font-medium tabular-nums">
                {hours.faceToFaceCredited.toLocaleString()} /{" "}
                {targets.faceToFaceMin.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Non-clinical (max)</dt>
              <dd className="text-right font-medium tabular-nums">
                {hours.nonClinicalCredited.toLocaleString()} /{" "}
                {targets.nonClinicalMax.toLocaleString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">This week</CardTitle>
          <CardDescription>
            Reported hours for the current Monday-start week (face-to-face +
            other direct clinical in the clinical total).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Clinical hours</dt>
              <dd className="font-medium tabular-nums">
                {week.clinicalHours}h
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Individual supervision</dt>
              <dd className="font-medium tabular-nums">
                {week.individualSupervisionHours}h
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Group supervision</dt>
              <dd className="font-medium tabular-nums">
                {week.groupSupervisionHours}h
              </dd>
            </div>
          </dl>
          <Separator />
          <p className="text-muted-foreground text-xs leading-relaxed">
            Weekly-loaded total (after {weeklyCreditCap}h cap):{" "}
            <span className="text-foreground font-medium tabular-nums">
              {cappedWeekTotal}h
            </span>
            {week.rawTotalHours != null && week.rawTotalHours > weeklyCreditCap
              ? ` (reported ${week.rawTotalHours}h before cap)`
              : null}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {model.rulesBlurb}
          </p>
          {supervisionRatio !== "not_applicable" ? (
            <p
              className={
                supervisionRatio === "invalid"
                  ? "text-amber-700 dark:text-amber-400 text-xs font-medium"
                  : "text-muted-foreground text-xs leading-relaxed"
              }
            >
              Supervision check (this track, weeks with clinical):{" "}
              {formatSupervisionRatioLabel(supervisionRatio)}
              {supervisionRatio === "invalid"
                ? " — add individual or group supervision to match your track’s weekly expectation."
                : null}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="text-primary size-5" aria-hidden />
            Registration / experience clock
          </CardTitle>
          <CardDescription>
            {model.sunsetYears}-year planning window from your saved registration
            date (adjust the date in Settings if your board letter differs).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-4xl font-semibold tabular-nums tracking-tight">
            {sunset.daysRemaining.toLocaleString()}
            <span className="text-muted-foreground text-lg font-medium">
              {" "}
              days left
            </span>
          </p>
          <p className="text-muted-foreground text-sm">
            Sunset date:{" "}
            <span className="text-foreground font-medium">
              {formatDate(sunset.endDate)}
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            Registered: {formatDate(sunset.registrationDate)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
