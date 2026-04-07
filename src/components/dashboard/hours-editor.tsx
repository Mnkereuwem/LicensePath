"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { toast } from "sonner";

import { BbsUploadDropzone } from "@/components/dashboard/bbs-upload-dropzone";
import { saveWeekHours } from "@/lib/actions/hours";
import {
  formatLocalISODate,
  formatWeekRangeLabel,
  startOfWeekMonday,
} from "@/lib/dates/week";
import {
  HOUR_FIELD_GROUPS,
  HOUR_CATEGORY_KEYS,
  type HourCategoryKey,
} from "@/lib/hours/categories";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatLocalISODate(d);
}

export function HoursEditor({
  weekStart,
  initial,
  weeklyCreditCap,
  licenseTrackLabel,
  rulesBlurb,
}: {
  weekStart: string;
  initial: Record<HourCategoryKey, number>;
  weeklyCreditCap: number;
  licenseTrackLabel: string;
  rulesBlurb: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialSnapshot = JSON.stringify(initial);
  const [values, setValues] = useState(initial);

  useEffect(() => {
    setValues(JSON.parse(initialSnapshot) as typeof initial);
  }, [weekStart, initialSnapshot]);

  const rawWeekSum = useMemo(
    () => HOUR_CATEGORY_KEYS.reduce((s, k) => s + (Number(values[k]) || 0), 0),
    [values],
  );

  const creditedPreview =
    rawWeekSum <= weeklyCreditCap
      ? rawWeekSum
      : Math.round(weeklyCreditCap * 100) / 100;

  async function onSave() {
    startTransition(async () => {
      const res = await saveWeekHours(weekStart, values);
      if (res.ok) {
        toast.success("Week saved", {
          description:
            rawWeekSum > weeklyCreditCap
              ? `Totals above ${weeklyCreditCap}h are scaled for credit this week.`
              : "Your dashboard will reflect these hours.",
        });
        router.refresh();
      } else {
        toast.error("Could not save", { description: res.message });
      }
    });
  }

  function shiftWeek(deltaWeeks: number) {
    const nw = addDays(weekStart, deltaWeeks * 7);
    router.push(`/dashboard/hours?week=${nw}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Log hours
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Track: <span className="text-foreground font-medium">{licenseTrackLabel}</span>
          . Enter hours for one week (Monday–Sunday). A{" "}
          {weeklyCreditCap}h credit cap applies across categories before writing{" "}
          <span className="text-foreground font-medium">credited hours</span>.{" "}
          <span className="text-foreground/90">{rulesBlurb}</span>
        </p>
      </div>

      <BbsUploadDropzone onSuccess={() => router.refresh()} />

      <Card className="border-border/60 shadow-lg shadow-black/20">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Week of</CardTitle>
              <CardDescription>
                {formatWeekRangeLabel(weekStart)} · Monday-start weeks
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Previous week"
                onClick={() => shiftWeek(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <input
                type="date"
                className="border-input bg-background text-foreground h-8 rounded-lg border px-2 text-sm shadow-none outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                value={weekStart}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const mon = startOfWeekMonday(new Date(`${v}T12:00:00`));
                  router.push(`/dashboard/hours?week=${mon}`);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Next week"
                onClick={() => shiftWeek(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  router.push(`/dashboard/hours?week=${startOfWeekMonday()}`)
                }
              >
                This week
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="bg-muted/40 flex flex-wrap items-baseline justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Reported total (raw)</span>
            <span className="text-foreground font-semibold tabular-nums">
              {rawWeekSum.toFixed(2)}h
            </span>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <span className="text-muted-foreground">Creditable this week</span>
            <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {creditedPreview.toFixed(2)}h
              {rawWeekSum > weeklyCreditCap ? (
                <span className="text-muted-foreground ml-2 font-normal">
                  (capped)
                </span>
              ) : null}
            </span>
          </div>

          <FieldGroup>
            {HOUR_FIELD_GROUPS.map((group) => (
              <FieldSet key={group.legend} className="rounded-xl border p-4">
                <FieldLegend variant="label">{group.legend}</FieldLegend>
                {group.description ? (
                  <FieldDescription className="mb-4">
                    {group.description}
                  </FieldDescription>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.keys.map(({ key, label, hint }) => (
                    <Field key={key} orientation="vertical">
                      <FieldLabel htmlFor={key}>{label}</FieldLabel>
                      {hint ? (
                        <FieldDescription>{hint}</FieldDescription>
                      ) : null}
                      <Input
                        id={key}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.25}
                        value={values[key] === 0 ? "" : values[key]}
                        placeholder="0"
                        onChange={(e) => {
                          const t = e.target.value;
                          const n =
                            t === "" ? 0 : Math.max(0, Number.parseFloat(t) || 0);
                          setValues((prev) => ({ ...prev, [key]: n }));
                        }}
                      />
                    </Field>
                  ))}
                </div>
              </FieldSet>
            ))}
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setValues(initial)}
              disabled={pending}
            >
              Reset
            </Button>
            <Button type="button" onClick={onSave} disabled={pending}>
              <Save className="size-4 opacity-80" />
              {pending ? "Saving…" : "Save week"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
