"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadBbsDocumentAndExtract } from "@/lib/actions/bbs-document-upload";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ACCEPT = "application/pdf,.pdf";

export function BbsUploadDropzone({ onSuccess }: { onSuccess?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const runUpload = useCallback(
    async (file: File) => {
      if (!file.size) {
        toast.error("Empty file.", {
          description: "Choose a PDF of your BBS weekly log.",
        });
        return;
      }
      setBusy(true);
      const loadingId = toast.loading("Uploading and reading your PDF…", {
        description: "This can take up to a minute on slow connections.",
      });
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadBbsDocumentAndExtract(fd);
        toast.dismiss(loadingId);
        if (res.ok) {
          const weeks =
            res.weeksUpdated.length === 0
              ? ""
              : ` Open the log for week starting ${res.weeksUpdated.join(", ")} (Monday dates).`;
          toast.success("Hours imported", {
            description: `Saved ${res.inserted} line(s) and added hours to your weekly log.${weeks}`,
          });
          onSuccess?.();
        } else {
          toast.error("Upload or OCR failed", { description: res.message });
        }
      } catch (e) {
        toast.dismiss(loadingId);
        const msg =
          e instanceof Error ? e.message : "Unexpected error (check connection).";
        toast.error("Upload failed", {
          description: msg,
        });
      } finally {
        setBusy(false);
      }
    },
    [onSuccess],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) void runUpload(f);
    },
    [runUpload],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void runUpload(f);
      e.target.value = "";
    },
    [runUpload],
  );

  return (
    <Card className="border-primary/25 bg-card/90 border shadow-lg shadow-black/15">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="bg-primary/12 text-primary ring-primary/20 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
            <FileText className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-snug">
              Upload BBS log (PDF only)
            </CardTitle>
            <CardDescription className="mt-1">
              <span className="text-foreground font-medium">PDF only</span> —
              save or export your weekly log as a PDF (phone camera photos are
              not supported here). We store the file privately, read it with
              GPT-4o, save lines to{" "}
              <span className="text-foreground font-medium">hours_logs</span>,
              and add hours to your weekly grid for the matching week
              (Monday–Sunday).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "focus-visible:ring-ring cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none",
            dragOver
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/35 hover:border-primary/50 hover:bg-muted/30 bg-muted/10",
          )}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={onPick}
          />
          <div className="flex flex-col items-center gap-3">
            {busy ? (
              <Loader2
                className="text-primary size-10 animate-spin"
                aria-hidden
              />
            ) : (
              <div className="flex items-center justify-center text-muted-foreground">
                <Upload className="size-10" aria-hidden />
              </div>
            )}
            <p className="text-foreground text-sm font-medium">
              {busy
                ? "Uploading and extracting…"
                : "Drop a PDF here, or click to choose"}
            </p>
            <p className="text-muted-foreground max-w-md text-xs leading-relaxed">
              PDF only · max 10 MB · needs{" "}
              <code className="text-foreground/80 bg-muted rounded px-1">
                OPENAI_API_KEY
              </code>{" "}
              on the server
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="pointer-events-none mt-1"
              tabIndex={-1}
            >
              Choose PDF
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
