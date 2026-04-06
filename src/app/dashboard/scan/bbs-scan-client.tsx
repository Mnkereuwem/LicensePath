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
import { extractBbsScanFromStorage } from "@/lib/actions/bbs-scan";
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
  const [review, setReview] = useState<{
    storagePath: string;
    previewUrl: string;
    entries: BbsScanExtractedEntry[];
  } | null>(null);

  const runAfterUpload = useCallback(async (storagePath: string) => {
    setPhase("extracting");
    const ex = await extractBbsScanFromStorage(storagePath);
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
      entries: ex.entries,
    });
  }, []);

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

  if (review) {
    return (
      <BbsScanReview
        previewUrl={review.previewUrl}
        storagePath={review.storagePath}
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
              run GPT-4o vision, and let you review before anything is saved.
            </>
          ) : (
            <>
              Pick a photo of your weekly log (camera or library). No app
              install needed—works in Safari and Chrome. Same upload and review
              flow as the mobile app.
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
                  ? "Reading log…"
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
                  ? "Reading log…"
                  : "Take or choose photo"}
            </Button>
            <p className="text-muted-foreground text-sm">
              Opens your camera or photo library depending on what you tap in
              the system picker.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
