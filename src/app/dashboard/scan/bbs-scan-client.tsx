"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageIcon, Loader2, ScanLine, Upload } from "lucide-react";
import { toast } from "sonner";

import { BbsScanReview } from "@/components/mobile/bbs-scan-review";
import {
  DUPLICATE_SCAN_DOCUMENT_CODE,
  extractBbsScanFromStorage,
} from "@/lib/actions/bbs-scan";
import {
  captureAndUploadBbsScan,
  isNativeBbsScanCamera,
  uploadBbsScanFromFile,
} from "@/lib/mobile/scan-service";
import type { BbsScanExtractedEntry } from "@/lib/mobile/bbs-scan-types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BbsScanClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNative = useMemo(() => isNativeBbsScanCamera(), []);

  const [phase, setPhase] = useState<"idle" | "uploading" | "extracting">(
    "idle",
  );
  const [duplicateAsk, setDuplicateAsk] = useState<{
    storagePath: string;
    message: string;
  } | null>(null);
  const [review, setReview] = useState<{
    storagePath: string;
    previewUrl: string;
    contentHash: string;
    entries: BbsScanExtractedEntry[];
  } | null>(null);

  const runAfterUpload = useCallback(async (storagePath: string) => {
    setPhase("extracting");
    try {
      let ex = await extractBbsScanFromStorage(storagePath);
      if (!ex.ok && "code" in ex && ex.code === DUPLICATE_SCAN_DOCUMENT_CODE) {
        setPhase("idle");
        setDuplicateAsk({ storagePath, message: ex.message });
        return;
      }
      setPhase("idle");
      if (!ex.ok) {
        toast.error("Could not read the log", { description: ex.message });
        return;
      }
      if (!ex.entries.length) {
        toast.message("No rows found", {
          description:
            "Try a clearer photo with visible dates and hour boxes filled in.",
        });
        return;
      }
      setReview({
        storagePath,
        previewUrl: ex.previewSignedUrl,
        contentHash: ex.contentHash,
        entries: ex.entries,
      });
    } catch (err) {
      setPhase("idle");
      const msg =
        err instanceof Error ? err.message : "Something went wrong reading the photo.";
      toast.error("Scan failed", {
        description:
          msg.includes("Failed to fetch") || msg.includes("Network")
            ? "Network error—check your connection and try again."
            : msg,
      });
    }
  }, []);

  const onDuplicateContinue = useCallback(async () => {
    if (!duplicateAsk) return;
    const path = duplicateAsk.storagePath;
    setDuplicateAsk(null);
    setPhase("extracting");
    try {
      const ex = await extractBbsScanFromStorage(path, {
        confirmDuplicate: true,
      });
      setPhase("idle");
      if (!ex.ok) {
        toast.error("Could not read the log", { description: ex.message });
        return;
      }
      if (!ex.entries.length) {
        toast.message("No rows found", {
          description:
            "Try a clearer photo with visible dates and hour boxes filled in.",
        });
        return;
      }
      setReview({
        storagePath: path,
        previewUrl: ex.previewSignedUrl,
        contentHash: ex.contentHash,
        entries: ex.entries,
      });
    } catch (err) {
      setPhase("idle");
      const msg =
        err instanceof Error ? err.message : "Something went wrong reading the photo.";
      toast.error("Scan failed", { description: msg });
    }
  }, [duplicateAsk]);

  const runNativeCapture = useCallback(async (source: "CAMERA" | "PHOTOS") => {
    setPhase("uploading");
    const up = await captureAndUploadBbsScan({ source });
    if (!up.ok) {
      setPhase("idle");
      toast.error("Upload failed", { description: up.message });
      return;
    }
    await runAfterUpload(up.storagePath);
  }, [runAfterUpload]);

  const onWebFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setPhase("uploading");
      const up = await uploadBbsScanFromFile(file);
      if (!up.ok) {
        setPhase("idle");
        toast.error("Upload failed", { description: up.message });
        return;
      }
      await runAfterUpload(up.storagePath);
    },
    [runAfterUpload],
  );

  if (duplicateAsk) {
    return (
      <>
        <Card className="border-primary/20 shadow-lg opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <ScanLine className="size-6" aria-hidden />
              AI BBS scanner
            </CardTitle>
          </CardHeader>
        </Card>
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-scan-title"
        >
          <div className="bg-background border-border max-h-[85vh] w-full max-w-md overflow-auto rounded-xl border p-5 shadow-xl">
            <h2 id="dup-scan-title" className="text-lg font-semibold">
              Duplicate image?
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {duplicateAsk.message}
            </p>
            <p className="mt-3 text-sm">
              Continue only if you want to add another copy of these hours.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                type="button"
                className="w-full sm:flex-1"
                onClick={() => void onDuplicateContinue()}
              >
                Preview hours anyway
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                onClick={() => setDuplicateAsk(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (review) {
    return (
      <BbsScanReview
        key={review.storagePath}
        previewUrl={review.previewUrl}
        storagePath={review.storagePath}
        contentHash={review.contentHash}
        extracted={review.entries}
        onCancel={() => setReview(null)}
        onDone={() => {
          setReview(null);
          router.push("/dashboard/hours");
          router.refresh();
        }}
      />
    );
  }

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <ScanLine className="size-6" aria-hidden />
          AI BBS scanner
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {isNative ? (
            <>
              Take a picture of your BBS weekly log. We upload it securely,
              run GPT-4o vision, then show a preview of the hours it read—you
              add them to your progress with one tap after you confirm.
            </>
          ) : (
            <>
              Pick a photo of your weekly log. You will see a preview of
              captured dates and hours, then tap to add them to your progress.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isNative ? (
          <>
            <Button
              type="button"
              className="min-h-14 w-full gap-2 text-base"
              disabled={phase !== "idle"}
              onClick={() => void runNativeCapture("CAMERA")}
            >
              {phase === "uploading" || phase === "extracting" ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Camera className="size-5" aria-hidden />
              )}
              {phase === "uploading"
                ? "Uploading…"
                : phase === "extracting"
                  ? "Reading log (15–90 sec)…"
                  : "Scan with camera"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-14 w-full gap-2 text-base"
              disabled={phase !== "idle"}
              onClick={() => void runNativeCapture("PHOTOS")}
            >
              <ImageIcon className="size-5" aria-hidden />
              Choose from photos
            </Button>
            {phase === "extracting" ? (
              <p className="text-muted-foreground text-sm">
                AI is reading your form—stay on this screen. If it takes longer
                than two minutes, check your connection or try a smaller photo.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onWebFileChange(e)}
            />
            <Button
              type="button"
              className="min-h-14 w-full gap-2 text-base"
              disabled={phase !== "idle"}
              onClick={() => fileInputRef.current?.click()}
            >
              {phase === "uploading" || phase === "extracting" ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-5" aria-hidden />
              )}
              {phase === "uploading"
                ? "Uploading…"
                : phase === "extracting"
                  ? "Reading log (15–90 sec)…"
                  : "Take or choose photo"}
            </Button>
            <p className="text-muted-foreground text-sm">
              {phase === "extracting"
                ? "AI is reading your form—stay on this screen. If it takes longer than two minutes, check your connection or try a smaller photo."
                : "Opens your camera or photo library depending on what you tap in the system picker."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
