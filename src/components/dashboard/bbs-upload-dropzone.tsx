"use client";

import { useCallback, useRef, useState } from "react";
import { FileImage, FileText, Loader2, Upload } from "lucide-react";
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

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

export function BbsUploadDropzone({ onSuccess }: { onSuccess?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const runUpload = useCallback(
    async (file: File) => {
      if (!file.size) {
        toast.error("Empty file.");
        return;
      }
      setBusy(true);
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadBbsDocumentAndExtract(fd);
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
              Upload BBS log (photo or PDF)
            </CardTitle>
            <CardDescription className="mt-1">
              Phone photos work (JPEG, PNG, HEIC): we normalize orientation and format
              before OCR. Files are stored privately; hours go to{" "}
              <span className="text-foreground font-medium">hours_logs</span> and your
              weekly grid for the matching week (Monday–Sunday).
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
              <div className="flex items-center gap-2 text-muted-foreground">
                <Upload className="size-8" aria-hidden />
                <FileImage className="size-8 opacity-70" aria-hidden />
              </div>
            )}
            <p className="text-foreground text-sm font-medium">
              {busy
                ? "Uploading and extracting…"
                : "Drop a file here, or click to choose"}
            </p>
            <p className="text-muted-foreground max-w-md text-xs leading-relaxed">
              JPEG / PNG / WebP / GIF / PDF · max 10 MB · requires{" "}
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
              Choose file
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
