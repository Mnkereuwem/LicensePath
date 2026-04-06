import { Capacitor } from "@capacitor/core";

import { BBS_UPLOADS_BUCKET } from "@/lib/mobile/bbs-scan-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type ScanUploadResult =
  | { ok: true; storagePath: string }
  | { ok: false; message: string };

/** True when `@capacitor/camera` can drive the native camera (iOS/Android shell). */
export function isNativeBbsScanCamera(): boolean {
  return Capacitor.isNativePlatform();
}

const MAX_SCAN_BYTES = 20 * 1024 * 1024;

async function uploadBbsScanBlobForUser(options: {
  blob: Blob;
  ext: string;
  contentType: string;
}): Promise<ScanUploadResult> {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Sign in to upload scans." };
  }

  const storagePath = `${user.id}/${Date.now()}_scan.${options.ext}`;
  const { error } = await supabase.storage
    .from(BBS_UPLOADS_BUCKET)
    .upload(storagePath, options.blob, {
      contentType: options.contentType,
      upsert: false,
    });

  if (error) {
    return {
      ok: false,
      message: error.message.includes("Bucket not found")
        ? "Storage bucket bbs-uploads missing. Run: npm run db:bbs-uploads"
        : error.message,
    };
  }

  return { ok: true, storagePath };
}

/**
 * Upload a user-selected image (Safari, desktop, etc.) to `bbs-uploads`.
 * Use this when `isNativeBbsScanCamera()` is false.
 */
export async function uploadBbsScanFromFile(file: File): Promise<ScanUploadResult> {
  if (!file.size) {
    return { ok: false, message: "Empty file." };
  }
  if (file.size > MAX_SCAN_BYTES) {
    return { ok: false, message: "Image too large (max 20 MB)." };
  }

  const fromType =
    file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
  const ext =
    fromType === "image/png"
      ? "png"
      : fromType === "image/webp"
        ? "webp"
        : "jpg";

  return uploadBbsScanBlobForUser({
    blob: file,
    ext,
    contentType: fromType,
  });
}

/**
 * Capture with the native camera or gallery inside the Capacitor app.
 * On web, returns an error — use `uploadBbsScanFromFile` instead.
 */
export async function captureAndUploadBbsScan(options?: {
  source?: "CAMERA" | "PHOTOS";
}): Promise<ScanUploadResult> {
  if (!Capacitor.isNativePlatform()) {
    return {
      ok: false,
      message:
        "Native camera runs in the LicensePath app. In the browser, use “Take or choose photo”.",
    };
  }

  try {
    const { Camera, CameraResultType, CameraSource } = await import(
      "@capacitor/camera"
    );

    const src =
      options?.source === "PHOTOS"
        ? CameraSource.Photos
        : CameraSource.Camera;

    const photo = await Camera.getPhoto({
      quality: 88,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: src,
      saveToGallery: false,
    });

    const webPath = photo.webPath;
    if (!webPath) {
      return { ok: false, message: "Camera did not return an image path." };
    }

    const res = await fetch(webPath);
    if (!res.ok) {
      return { ok: false, message: "Could not read photo data." };
    }
    const blob = await res.blob();
    const ext =
      photo.format === "png"
        ? "png"
        : photo.format === "jpeg" || photo.format === "jpg"
          ? "jpg"
          : "jpg";
    const contentType =
      ext === "png"
        ? "image/png"
        : photo.format === "webp"
          ? "image/webp"
          : "image/jpeg";

    return uploadBbsScanBlobForUser({ blob, ext, contentType });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Camera or upload failed.";
    return { ok: false, message: msg };
  }
}
