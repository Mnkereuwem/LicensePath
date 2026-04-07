import "server-only";

import OpenAI from "openai";

import {
  BBS_DAILY_CLINICAL_HOURS_MAX,
  DEFAULT_EXPERIENCE_YEAR,
} from "@/lib/compliance/bbs-rules";
import type {
  BbsScanExtractedEntry,
  BbsScanFieldConfidence,
} from "@/lib/mobile/bbs-scan-types";

function getOpenAiApiKey(): string {
  const raw = process.env["OPENAI_API_KEY"];
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\r$/, "");
}

function requireOpenAiKey(): string {
  const key = getOpenAiApiKey();
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it for Production on your host (e.g. Vercel) and redeploy.",
    );
  }
  return key;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(y: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(y, month - 1, day));
  if (
    d.getUTCFullYear() !== y ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  )
    return null;
  return `${y}-${pad2(month)}-${pad2(day)}`;
}

/** Normalize model output to YYYY-MM-DD; default missing year to DEFAULT_EXPERIENCE_YEAR. */
function normalizeScanDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return ymd(Number(m[3]), Number(m[1]), Number(m[2]));

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/);
  if (m) {
    let y = Number(m[3]);
    y += y >= 70 ? 1900 : 2000;
    return ymd(y, Number(m[1]), Number(m[2]));
  }

  /* MM/DD without year */
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (m) {
    return ymd(DEFAULT_EXPERIENCE_YEAR, Number(m[1]), Number(m[2]));
  }

  return null;
}

function clampHours(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, 999) * 100) / 100;
}

const SYSTEM = `You read California BBS-style ASW weekly experience logs (form 37A-638 or similar) from a photograph.

Return JSON only (no markdown) with key "entries": array (max 15). Each entry:
- "work_date": string — calendar date for that row/column. Prefer YYYY-MM-DD. If the year is missing on the form, use ${DEFAULT_EXPERIENCE_YEAR}.
- "direct_clinical_counseling_hours": number — face-to-face / direct clinical counseling and related clinical client-contact hours shown for that date (not supervision). Use 0 if blank.
- "non_clinical_supervision_hours": number — group + individual supervision hours combined for that date, plus any other non-clinical supervision blocks if they are not already clinical. If the form separates individual vs group, sum them here. Use 0 if blank.
- "supervised_site_name": string or null — employer / site / work setting if visible.
- "confidence": object with numbers 0–1 for: "date", "clinical", "supervision", "site" — your estimate of read quality for each field.

Rules:
- Numbers only for hours; decimals allowed.
- Do not invent dates: if a date cannot be read, omit that entry.
- If nothing is legible return {"entries": []}.`;

const VISION_TIMEOUT_MS = 90_000;

export async function extractBbsRowsFromScanImage(input: {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}): Promise<BbsScanExtractedEntry[]> {
  const openai = new OpenAI({
    apiKey: requireOpenAiKey(),
    timeout: VISION_TIMEOUT_MS,
    maxRetries: 0,
  });
  const dataUrl = `data:${input.mimeType};base64,${input.base64}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all readable day/week rows from this BBS weekly log photo into the JSON schema.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 4096,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];

  let parsed: {
    entries?: Array<{
      work_date?: string;
      direct_clinical_counseling_hours?: unknown;
      non_clinical_supervision_hours?: unknown;
      supervised_site_name?: unknown;
      confidence?: Partial<Record<string, number>>;
    }>;
  };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch {
    return [];
  }

  if (!parsed.entries || !Array.isArray(parsed.entries)) return [];

  const out: BbsScanExtractedEntry[] = [];

  for (const row of parsed.entries) {
    if (out.length >= 15) break;
    if (!row || typeof row.work_date !== "string") continue;
    const workDate = normalizeScanDate(row.work_date);
    if (!workDate) continue;

    let clinical = clampHours(
      typeof row.direct_clinical_counseling_hours === "number"
        ? row.direct_clinical_counseling_hours
        : Number(row.direct_clinical_counseling_hours),
    );
    let clinicalCapped = false;
    if (clinical > BBS_DAILY_CLINICAL_HOURS_MAX) {
      clinicalCapped = true;
      clinical = BBS_DAILY_CLINICAL_HOURS_MAX;
    }

    const supervision = clampHours(
      typeof row.non_clinical_supervision_hours === "number"
        ? row.non_clinical_supervision_hours
        : Number(row.non_clinical_supervision_hours),
    );

    const siteName =
      typeof row.supervised_site_name === "string" &&
      row.supervised_site_name.trim().length > 0
        ? row.supervised_site_name.trim().slice(0, 500)
        : null;

    const c = row.confidence ?? {};
    const confidence: BbsScanFieldConfidence = {
      date: clamp01(c.date),
      clinical: clamp01(c.clinical),
      supervision: clamp01(c.supervision),
      site: clamp01(c.site),
    };

    out.push({
      work_date: workDate,
      direct_clinical_counseling_hours: clinical,
      non_clinical_supervision_hours: supervision,
      supervised_site_name: siteName,
      confidence,
      clinical_capped: clinicalCapped,
    });
  }

  return out;
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0.5;
  return Math.min(1, Math.max(0, x));
}
