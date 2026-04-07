import { NextResponse } from "next/server";

import {
  extractBbsScanFromStorageCore,
  type ExtractBbsScanResult,
} from "@/lib/server/bbs-scan-extract-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * JSON extract endpoint for BBS photo scans. Prefer this over the Server Action
 * from Capacitor when framework-level action failures still occur (timeouts, digest errors).
 */
export async function POST(req: Request): Promise<NextResponse<ExtractBbsScanResult>> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const storagePath = typeof rec.storagePath === "string" ? rec.storagePath : "";
    const confirmDuplicate = Boolean(rec.confirmDuplicate);

    if (!storagePath.trim()) {
      return NextResponse.json({
        ok: false,
        message: "Missing storagePath.",
      });
    }

    const result = await extractBbsScanFromStorageCore(storagePath, {
      confirmDuplicate,
    });
    return NextResponse.json(result);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/bbs-scan/extract]", raw);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Scan could not finish on the server. Check OPENAI_API_KEY, Supabase migrations (license_track + source_content_hash), and that your host allows ~3 minute requests.",
      },
      { status: 200 },
    );
  }
}
