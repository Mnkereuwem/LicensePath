import "server-only";

import sharp from "sharp";

/** Extension → MIME when the browser sends an empty or generic type (common on phones). */
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii").replace(/\0/g, "");
    if (/^(heic|heix|hevc|heim|heis|mif1|msf1)/i.test(brand)) {
      return "image/heic";
    }
  }
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.subarray(0, 8).equals(pngSig)) return "image/png";
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  const g = buf.subarray(0, 6).toString("ascii");
  if (g === "GIF87a" || g === "GIF89a") return "image/gif";
  return null;
}

/**
 * Resolves a reliable MIME for uploads (fixes mobile `file.type === ""` and HEIC).
 */
export function resolveEffectiveMime(file: File, buf: Buffer): string {
  let t = (file.type || "").toLowerCase().trim();
  if (t === "image/jpg" || t === "image/pjpeg") t = "image/jpeg";
  if (t === "image/x-png") t = "image/png";

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const fromExt = ext ? EXT_TO_MIME[ext] : undefined;

  if (t && t !== "application/octet-stream") {
    if (t === "image/heif") return "image/heic";
    return t;
  }

  if (fromExt) return fromExt === "image/heif" ? "image/heic" : fromExt;

  return sniffMime(buf) ?? t ?? "application/octet-stream";
}

/**
 * Apply EXIF orientation and emit JPEG so GPT-4o vision and storage see a standard raster.
 * HEIC/HEIF from iPhones is decoded here.
 */
export async function prepareRasterForOcr(
  buf: Buffer,
  mime: string,
): Promise<{ buf: Buffer; contentType: string }> {
  if (mime === "application/pdf") {
    return { buf, contentType: mime };
  }

  try {
    const out = await sharp(buf)
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return { buf: out, contentType: "image/jpeg" };
  } catch (e) {
    const isHeic = mime === "image/heic" || mime === "image/heif";
    if (isHeic) {
      throw new Error(
        "Could not read this iPhone photo (HEIC). In Settings → Camera → Formats choose “Most Compatible”, or export as JPEG from Photos, then try again.",
        { cause: e },
      );
    }
    /* Last resort: pass through (may still fail downstream) */
    return { buf, contentType: mime };
  }
}
