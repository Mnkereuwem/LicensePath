"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { confirmBbsScanAndSave } from "@/lib/actions/bbs-scan";
import type {
  BbsScanConfirmRowInput,
  BbsScanExtractedEntry,
} from "@/lib/mobile/bbs-scan-types";
import { SCAN_LOW_CONFIDENCE_THRESHOLD } from "@/lib/mobile/bbs-scan-types";
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
  extracted,
  onDone,
  onCancel,
}: {
  previewUrl: string;
  storagePath: string;
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
        rows,
        fileNameHint: storagePath.split("/").pop(),
      });
      if (res.ok) {
        toast.success("Saved to your log", {
          description: `${res.inserted} row(s); weekly totals updated for ${res.weeksUpdated.join(", ") || "—"}.`,
        });
        onDone();
      } else {
        toast.error("Could not save", { description: res.message });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/80 overflow-hidden shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Review scan</CardTitle>
        <CardDescription>
          Check values before saving. Amber highlights mean the model was less
          sure—edit if needed. Nothing is written to{" "}
          <span className="text-foreground font-medium">hours_logs</span> until
          you confirm.
        </CardDescription>
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
            <FieldGroup key={`${ex.work_date}-${i}`} className="gap-3 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium">
                Row {i + 1}
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
              Saving…
            </>
          ) : (
            "Confirm and save"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
