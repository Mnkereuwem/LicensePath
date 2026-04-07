"use server";

import { revalidatePath } from "next/cache";

import { subtractParsedBbsEntriesFromWeeklyGrid } from "@/lib/actions/hours";
import { BBS_DOCUMENTS_BUCKET, BBS_UPLOADS_BUCKET } from "@/lib/mobile/bbs-scan-types";
import type { ParsedBbsEntry } from "@/lib/openai/bbs-ocr";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function assertOwnStoragePath(userId: string, storagePath: string): boolean {
  const first = storagePath.split("/")[0];
  return Boolean(first && first === userId);
}

function storageBucketForSourcePath(path: string): typeof BBS_DOCUMENTS_BUCKET | typeof BBS_UPLOADS_BUCKET {
  return /\.pdf$/i.test(path) ? BBS_DOCUMENTS_BUCKET : BBS_UPLOADS_BUCKET;
}

export type DeleteBbsDocumentationResult =
  | { ok: true; removedLines: number; weeksTouched: string[] }
  | { ok: false; message: string };

/**
 * Removes all hours_log lines tied to one upload, subtracts their effect from
 * the weekly hour grid, and deletes the source file from storage.
 */
export async function deleteBbsDocumentationByStoragePath(
  storagePath: string,
): Promise<DeleteBbsDocumentationResult> {
  const trimmed = storagePath.trim();
  if (!trimmed) {
    return { ok: false, message: "Missing document path." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }
  if (!assertOwnStoragePath(user.id, trimmed)) {
    return { ok: false, message: "Invalid document path." };
  }

  const { data: logRows, error: fetchErr } = await supabase
    .from("hours_logs")
    .select(
      "work_date, clinical_hours, individual_supervision_hours, group_supervision_hours, site_name",
    )
    .eq("supervisee_id", user.id)
    .eq("source_storage_path", trimmed);

  if (fetchErr) {
    return { ok: false, message: fetchErr.message };
  }
  if (!logRows?.length) {
    return { ok: false, message: "No saved import found for that file." };
  }

  const entries: ParsedBbsEntry[] = logRows.map((r) => {
    const d = r.work_date as string;
    return {
      date: typeof d === "string" ? d.slice(0, 10) : "",
      clinical_hours: Number(r.clinical_hours) || 0,
      individual_supervision_hours: Number(r.individual_supervision_hours) || 0,
      group_supervision_hours: Number(r.group_supervision_hours) || 0,
      site_name:
        typeof r.site_name === "string" && r.site_name.length > 0 ? r.site_name : null,
    };
  });

  const grid = await subtractParsedBbsEntriesFromWeeklyGrid(entries);
  if (!grid.ok) {
    return { ok: false, message: grid.message };
  }

  const { error: delLogErr } = await supabase
    .from("hours_logs")
    .delete()
    .eq("supervisee_id", user.id)
    .eq("source_storage_path", trimmed);

  if (delLogErr) {
    return {
      ok: false,
      message: `${delLogErr.message} Weekly totals were already reduced; contact support if lines remain.`,
    };
  }

  const bucket = storageBucketForSourcePath(trimmed);
  const { error: storageErr } = await supabase.storage.from(bucket).remove([trimmed]);
  if (storageErr && process.env.NODE_ENV === "development") {
    console.warn("[deleteBbsDocumentation] storage remove:", storageErr.message);
  }

  revalidatePath("/dashboard/bbs-documentation");
  return {
    ok: true,
    removedLines: logRows.length,
    weeksTouched: grid.weeksTouched,
  };
}
