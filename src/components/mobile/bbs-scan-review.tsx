"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { confirmBbsScanAndSave } from "@/lib/actions/bbs-scan";
import type {
  BbsScanConfirmRowInput,
  BbsScanExtractedEntry,
} from "@/lib/mobile/bbs-scan-types";
import { SCAN_LOW_CONFIDENCE_THRESHOLD } from "@/lib/mobile/bbs-scan-types";
import { describeScanFailure } from "@/lib/mobile/scan-error-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function lowClass(v: number): string {
  return v < SCAN_LOW_CONFIDENCE_THRESHOLD
    ? "ring-2 ring-amber-500/80 ring-offset-2 ring-offset-background"
    : "";
}

export function BbsScanReview({
  previewUrl,
  storagePath,
  contentHash,
  extracted,
  onDone,
  onCancel,
}: {
  previewUrl: string;
  storagePath: string;
  contentHash: string;
  extracted: BbsScanExtractedEntry[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const initialRows: BbsScanConfirmRowInput[] = useMemo(
    () =>
      extracted.map((e) => ({
        work_date: e.work_date,
        direct_clinical_counseling_hours: e.direct_clinical_counseling_hours,
        non_clinical_supervision_hours: e.non_clinical_supervision_hours,
        supervised_site_name: e.supervised_site_name,
      })),
    [extracted],
  );

  const [rows, setRows] = useState<BbsScanConfirmRowInput[]>(initialRows);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    let clinical = 0;
    let supervision = 0;
    for (const r of rows) {
      clinical += Math.max(0, r.direct_clinical_counseling_hours);
      supervision += Math.max(0, r.non_clinical_supervision_hours);
    }
    return {
      clinical: Math.round(clinical * 100) / 100,
      supervision: Math.round(supervision * 100) / 100,
    };
  }, [rows]);

  const duplicateServiceDates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.work_date) continue;
      counts.set(r.work_date, (counts.get(r.work_date) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n > 1)
      .map(([d]) => d)
      .sort();
  }, [rows]);

  function updateRow(
    index: number,
    patch: Partial<BbsScanConfirmRowInput>,
  ): void {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  async function onConfirm() {
    setSaving(true);
    try {
      const res = await confirmBbsScanAndSave({
        storagePath,
        contentHash,
        rows,
        fileNameHint: storagePath.split("/").pop(),
      });
      if (res.ok) {
        toast.success("Hours added to your progress", {
          description: `${res.inserted} row(s); weeks updated: ${res.weeksUpdated.join(", ") || "—"}.`,
        });
        onDone();
      } else {
        toast.error("Could not save", { description: res.message });
      }
    } catch (err) {
      toast.error("Could not save", { description: describeScanFailure(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/80 overflow-hidden shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Preview captured hours</CardTitle>
        <CardDescription>
          Here is what we read from your photo. Adjust any cell if needed, then
          tap <span className="text-foreground font-medium">Add to my hours</span>{" "}
          to save into your weekly progress and log. Nothing is stored until you
          tap that button.
        </CardDescription>
        <div
          className="border-border/60 bg-card overflow-hidden rounded-xl border"
          role="region"
          aria-label="Captured hours summary"
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/50 border-border/60 border-b">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Clinical (h)</th>
                <th className="px-3 py-2 text-right font-medium">Supervision (h)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.work_date}-${i}`}
                  className="border-border/40 border-b last:border-b-0"
                >
                  <td className="text-foreground px-3 py-2 font-medium tabular-nums">
                    {r.work_date || "—"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                    {Math.round(r.direct_clinical_counseling_hours * 100) / 100}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                    {Math.round(r.non_clinical_supervision_hours * 100) / 100}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-muted-foreground border-border/60 bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm">
          <span>
            <span className="text-foreground font-medium">Σ Clinical:</span>{" "}
            {totals.clinical}h
          </span>
          <span>
            <span className="text-foreground font-medium">Σ Supervision:</span>{" "}
            {totals.supervision}h
          </span>
          <span>
            <span className="text-foreground font-medium">Rows:</span>{" "}
            {rows.length}
          </span>
        </div>
        {duplicateServiceDates.length > 0 ? (
          <p className="text-amber-700 dark:text-amber-500 text-sm">
            Multiple rows share the same service date (
            {duplicateServiceDates.join(", ")}). Hours for those days will add
            together in your weekly log—correct the dates if that is not what
            you want.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="bg-muted border-border/60 flex max-h-[min(70vh,520px)] min-h-[200px] items-center justify-center overflow-auto rounded-xl border lg:max-h-none lg:min-h-[320px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
          <img
            src={previewUrl}
            alt="BBS weekly log scan"
            className="max-h-[min(70vh,520px)] w-full max-w-full object-contain lg:max-h-[560px]"
          />
        </div>
        <div className="flex flex-col gap-4">
          {extracted.map((ex, i) => (
            <FieldGroup
              key={`${ex.work_date}-${i}`}
              className="gap-3 rounded-lg border p-4"
            >
              <p className="text-muted-foreground text-xs font-medium">
                Edit row {i + 1}
                {ex.clinical_capped && (
                  <span className="text-amber-600 ml-2">
                    (Clinical hours capped to daily guardrail)
                  </span>
                )}
              </p>
              <Field className={cn("gap-1.5", lowClass(ex.confidence.date))}>
                <FieldLabel className="text-sm">Date of service</FieldLabel>
                <Input
                  className="min-h-11 text-base"
                  type="date"
                  value={rows[i]?.work_date ?? ""}
                  onChange={(e) =>
                    updateRow(i, { work_date: e.target.value })
                  }
                />
              </Field>
              <Field
                className={cn("gap-1.5", lowClass(ex.confidence.clinical))}
              >
                <FieldLabel className="text-sm">
                  Direct clinical counseling (hrs)
                </FieldLabel>
                <Input
                  className="min-h-11 text-base"
                  inputMode="decimal"
                  value={String(rows[i]?.direct_clinical_counseling_hours ?? 0)}
                  onChange={(e) =>
                    updateRow(i, {
                      direct_clinical_counseling_hours:
                        Number.parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field
                className={cn("gap-1.5", lowClass(ex.confidence.supervision))}
              >
                <FieldLabel className="text-sm">
                  Non-clinical / supervision (hrs)
                </FieldLabel>
                <Input
                  className="min-h-11 text-base"
                  inputMode="decimal"
                  value={String(rows[i]?.non_clinical_supervision_hours ?? 0)}
                  onChange={(e) =>
                    updateRow(i, {
                      non_clinical_supervision_hours:
                        Number.parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field className={cn("gap-1.5", lowClass(ex.confidence.site))}>
                <FieldLabel className="text-sm">Supervised site name</FieldLabel>
                <Input
                  className="min-h-11 text-base"
                  value={rows[i]?.supervised_site_name ?? ""}
                  placeholder="Employer / program"
                  onChange={(e) =>
                    updateRow(i, {
                      supervised_site_name:
                        e.target.value.trim() === ""
                          ? null
                          : e.target.value.trim(),
                    })
                  }
                />
              </Field>
            </FieldGroup>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-12 w-full sm:w-auto sm:min-w-[8rem]"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="min-h-12 w-full gap-2 sm:w-auto sm:min-w-[12rem]"
          onClick={() => void onConfirm()}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin" />
              Adding to your hours…
            </>
          ) : (
            "Add to my hours"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
