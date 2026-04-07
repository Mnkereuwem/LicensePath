import "server-only";

import OpenAI from "openai";

import { DEFAULT_EXPERIENCE_YEAR } from "@/lib/compliance/bbs-rules";
import { getTrackHourRules } from "@/lib/compliance/track-hour-rules";
import {
  buildScanVisionSystemPrompt,
  normalizeLicenseTrack,
  type LicenseTrackId,
} from "@/lib/licensing/license-tracks";
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

type DateNormOptions = { defaultYear: number; preferMDY: boolean };

/** Normalize model output to YYYY-MM-DD. US worksheets default to month-first when ambiguous. */
function normalizeScanDate(raw: string, opts: DateNormOptions): string | null {
  const s = raw.trim();
  const { defaultYear, preferMDY } = opts;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  /* MM/DD/YYYY or DD/MM/YYYY — disambiguate with part > 12 */
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (a > 12) return ymd(y, b, a); /* day first */
    if (b > 12) return ymd(y, a, b); /* month first */
    if (preferMDY) return ymd(y, a, b);
    return ymd(y, b, a);
  }

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/);
  if (m) {
    let y = Number(m[3]);
    y += y >= 70 ? 1900 : 2000;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) return ymd(y, b, a);
    if (b > 12) return ymd(y, a, b);
    if (preferMDY) return ymd(y, a, b);
    return ymd(y, b, a);
  }

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) return ymd(defaultYear, b, a);
    if (b > 12) return ymd(defaultYear, a, b);
    if (preferMDY) return ymd(defaultYear, a, b);
    return ymd(defaultYear, b, a);
  }

  return null;
}

function numField(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampHours(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(n, 999) * 100) / 100;
}

/** Align with host `maxDuration` (~300s); vision + IO should finish inside this. */
const VISION_TIMEOUT_MS = 150_000;

export async function extractBbsRowsFromScanImage(input: {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** From profile; tailors prompt to board-specific hour logs */
  licenseTrack?: string | null;
}): Promise<BbsScanExtractedEntry[]> {
  const track: LicenseTrackId = normalizeLicenseTrack(input.licenseTrack);
  const trackRules = getTrackHourRules(track);
  const system = buildScanVisionSystemPrompt({
    track,
    defaultExperienceYear: DEFAULT_EXPERIENCE_YEAR,
  });
  const dateOpts: DateNormOptions = {
    defaultYear: DEFAULT_EXPERIENCE_YEAR,
    /* All current license tracks are US boards — month/day ambiguity resolves as MM/DD. */
    preferMDY: true,
  };
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
      { role: "system", content: system },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read each dated row or day-column carefully. Separate direct clinical (client-facing) hours from individual vs group supervision. Output the JSON schema; dates must match the form’s calendar day for each cell.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
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
      individual_supervision_hours?: unknown;
      group_supervision_hours?: unknown;
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
    const workDate = normalizeScanDate(row.work_date, dateOpts);
    if (!workDate) continue;

    let clinical = clampHours(numField(row.direct_clinical_counseling_hours));
    let clinicalCapped = false;
    if (clinical > trackRules.dailyClinicalHoursMax) {
      clinicalCapped = true;
      clinical = trackRules.dailyClinicalHoursMax;
    }

    let indSup = clampHours(numField(row.individual_supervision_hours));
    let grpSup = clampHours(numField(row.group_supervision_hours));
    if (indSup === 0 && grpSup === 0 && row.non_clinical_supervision_hours !== undefined) {
      const legacy = clampHours(numField(row.non_clinical_supervision_hours));
      if (legacy > 0) {
        indSup = legacy;
      }
    }

    const siteName =
      typeof row.supervised_site_name === "string" &&
      row.supervised_site_name.trim().length > 0
        ? row.supervised_site_name.trim().slice(0, 500)
        : null;

    const c = row.confidence ?? {};
    const legSup = c.supervision;
    const confidence: BbsScanFieldConfidence = {
      date: clamp01(c.date),
      clinical: clamp01(c.clinical),
      supervision_individual: clamp01(c.supervision_individual ?? legSup),
      supervision_group: clamp01(c.supervision_group ?? legSup),
      site: clamp01(c.site),
    };

    out.push({
      work_date: workDate,
      direct_clinical_counseling_hours: clinical,
      individual_supervision_hours: indSup,
      group_supervision_hours: grpSup,
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
