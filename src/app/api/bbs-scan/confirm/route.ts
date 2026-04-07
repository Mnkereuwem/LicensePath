import { NextResponse } from "next/server";

import type { BbsScanConfirmRowInput } from "@/lib/mobile/bbs-scan-types";
import {
  confirmBbsScanAndSaveCore,
  type ConfirmBbsScanResult,
} from "@/lib/server/bbs-scan-confirm-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<NextResponse<ConfirmBbsScanResult>> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const storagePath = typeof rec.storagePath === "string" ? rec.storagePath : "";
    const contentHash = typeof rec.contentHash === "string" ? rec.contentHash : "";
    const fileNameHint =
      typeof rec.fileNameHint === "string" ? rec.fileNameHint : undefined;
    const rows = Array.isArray(rec.rows) ? rec.rows : null;

    if (!storagePath.trim() || !contentHash) {
      return NextResponse.json({
        ok: false,
        message: "Missing storagePath or contentHash.",
      });
    }
    if (!rows?.length) {
      return NextResponse.json({
        ok: false,
        message: "Nothing to save.",
      });
    }

    const result = await confirmBbsScanAndSaveCore({
      storagePath,
      contentHash,
      fileNameHint,
      rows: rows as BbsScanConfirmRowInput[],
    });
    return NextResponse.json(result);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/bbs-scan/confirm]", raw);
    return NextResponse.json({
      ok: false,
      message: "Could not save scan rows. Try again in a moment.",
    });
  }
}
