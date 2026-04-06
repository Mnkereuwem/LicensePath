"use server";

import { revalidatePath } from "next/cache";

import {
  extractBbsEntriesFromImageDataUrl,
  extractBbsEntriesFromText,
  extractTextFromPdfBuffer,
} from "@/lib/openai/bbs-ocr";
import { ensureProfileForUser } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BUCKET = "bbs-documents";
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
}

export async function uploadBbsDocumentAndExtract(
  formData: FormData,
): Promise<
  | { ok: true; inserted: number; storagePath: string }
  | { ok: false; message: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, message: "No file uploaded." };
  }

  if (file.size > MAX_BYTES) {
    return { ok: false, message: "File must be 10MB or smaller." };
  }

  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED.has(mime)) {
    return {
      ok: false,
      message: "Use a JPEG, PNG, WebP, GIF, or PDF file.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  let organizationId = profile?.organization_id ?? null;
  if (!organizationId) {
    const fixed = await ensureProfileForUser(user);
    if (!fixed.ok) {
      return { ok: false, message: fixed.message };
    }
    organizationId = fixed.organizationId;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const storagePath = `${user.id}/${Date.now()}_${safeFileName(file.name)}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, {
      contentType: mime,
      upsert: false,
    });

  if (upErr) {
    return {
      ok: false,
      message: upErr.message.includes("Bucket not found")
        ? "Storage bucket missing. Run: npm run db:bbs-storage (or apply the hours_logs migration in Supabase)."
        : upErr.message,
    };
  }

  let entries;
  try {
    if (mime === "application/pdf") {
      const text = await extractTextFromPdfBuffer(buf);
      if (text.length < 40) {
        return {
          ok: false,
          message:
            "Could not read enough text from this PDF (it may be scanned). Try exporting a page as an image (PNG/JPEG) and upload that instead.",
        };
      }
      entries = await extractBbsEntriesFromText(text);
    } else {
      const b64 = buf.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      entries = await extractBbsEntriesFromImageDataUrl(dataUrl);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OCR failed.";
    return { ok: false, message: msg };
  }

  if (!entries.length) {
    return {
      ok: false,
      message:
        "No hour rows were extracted. Try a clearer photo or check that the form shows dates and hours.",
    };
  }

  const ocrRawFirst = JSON.parse(
    JSON.stringify({ model: "gpt-4o", fileName: file.name, entries }),
  ) as Record<string, unknown>;

  const rows = entries.map((e, i) => ({
    organization_id: organizationId,
    supervisee_id: user.id,
    work_date: e.date,
    site_name: e.site_name,
    individual_supervision_hours: e.individual_supervision_hours,
    group_supervision_hours: e.group_supervision_hours,
    clinical_hours: e.clinical_hours,
    source_storage_path: storagePath,
    ocr_raw: i === 0 ? ocrRawFirst : null,
  }));

  const { error: insErr } = await supabase.from("hours_logs").insert(rows);

  if (insErr) {
    return {
      ok: false,
      message: insErr.message,
    };
  }

  revalidatePath("/dashboard/hours");
  revalidatePath("/dashboard");

  return { ok: true, inserted: rows.length, storagePath };
}
