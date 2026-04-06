import "server-only";

import OpenAI, { toFile } from "openai";

export type ParsedBbsEntry = {
  date: string;
  individual_supervision_hours: number;
  group_supervision_hours: number;
  clinical_hours: number;
  site_name: string | null;
};

const SYSTEM_PROMPT = `You extract structured hour data from experience-tracking documents. Prioritize California BBS forms (e.g. DCA BBS 37A-638 / ASW "Weekly Log of Experience Hours") but accept agency weekly grids, internship logs, or similar.

BBS 37A-638 layout: columns are usually labeled "Week of:" with a date; rows include "Supervision, Individual or Triadic", "Supervision, Group", and clinical / psychosocial work. Letters A, A1, B, C and "Total Hours Per Week" may appear—use the cell that matches each category for that week column. Do not double-count: if instructions say a sub-row (e.g. A1) is excluded from weekly totals, follow the form.

Mapping to output fields:
- individual_supervision_hours: individual or triadic supervision hours for that week/date.
- group_supervision_hours: group supervision for that week/date.
- clinical_hours: direct clinical / client-contact / qualifying non-supervision hours for that week (sum sub-rows if needed, excluding pure supervision). If the sheet only shows one combined non-supervision total per week and breakdown is unclear, put that total here and put 0 in supervision fields unless supervision is listed separately.

Return one JSON object with key "entries" (array, max 50). Each item:
- "date": calendar date for that row/column in YYYY-MM-DD (normalize any US dates you read).
- "individual_supervision_hours", "group_supervision_hours", "clinical_hours": numbers (0 if blank).
- "site_name": worksite / employer / program name if visible, else empty string.

Rules:
- Read printed text, typed entries, and handwriting when possible.
- Hour values are numeric only (decimals allowed). Treat blank/dash as 0.
- One entry per distinct week/date column (or per dated row) that has at least one hour > 0 OR a clear week date—skip completely empty week columns.
- If nothing is filled or legible, return {"entries": []}.
- Do not invent dates. Skip illegible rows.
- Output must match the requested JSON shape exactly.`;

const PDF_USER_INSTRUCTIONS = `This PDF is an ASW/BBS weekly log, supervision sheet, or similar hour tracker. Use the full page layout (including handwriting and scanned content). Extract each "Week of" / week column (or dated row) into the schema. If multiple pages, merge into one entries list.`;

/** Strict structured output schema for Responses API (site_name empty string when unknown). */
const ENTRIES_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: {
            type: "string",
            description:
              "Week date as YYYY-MM-DD (you must normalize from whatever appears on the form).",
          },
          individual_supervision_hours: { type: "number" },
          group_supervision_hours: { type: "number" },
          clinical_hours: { type: "number" },
          site_name: {
            type: "string",
            description: "Employer or site name, or empty string.",
          },
        },
        required: [
          "date",
          "individual_supervision_hours",
          "group_supervision_hours",
          "clinical_hours",
          "site_name",
        ],
      },
    },
  },
  required: ["entries"],
} as const;

const MAX_ENTRIES = 50;
const MAX_PDF_TEXT_CHARS = 120_000;

function getOpenAiApiKey(): string {
  const raw = process.env["OPENAI_API_KEY"];
  if (typeof raw !== "string") return "";
  /* trim + strip stray CR (Windows editors) */
  return raw.trim().replace(/\r$/, "");
}

function requireOpenAiKey(): string {
  const key = getOpenAiApiKey();
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local at the project root (OPENAI_API_KEY=sk-...), save, then fully restart \"npm run dev\". On Vercel: Project Settings → Environment Variables → add OPENAI_API_KEY for Production (and Preview if needed), then Redeploy.",
    );
  }
  return key;
}

function clampHours(n: unknown): number {
  const x =
    typeof n === "number"
      ? n
      : typeof n === "string"
        ? Number.parseFloat(n)
        : 0;
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.round(Math.min(x, 80) * 100) / 100;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(y: number, month: number, day: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day))
    return null;
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

/** Accept model output in several US/common shapes → YYYY-MM-DD */
function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  /* tolerate "Week of: 1/6/2025" etc. */
  const low = s.toLowerCase();
  if (low.startsWith("week of")) {
    s = s.replace(/^week\s+of\s*[:\s]*/i, "").trim();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = Number(m[3]);
    /* US forms: month/day/year */
    return ymd(y, mo, d);
  }

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    let y = Number(m[3]);
    y += y >= 70 ? 1900 : 2000;
    return ymd(y, mo, d);
  }

  /* Month name */
  m = s.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})$/,
  );
  if (m) {
    const monthIx = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf(m[1].toLowerCase());
    if (monthIx >= 0) {
      return ymd(Number(m[3]), monthIx + 1, Number(m[2]));
    }
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    /* reject if parser guessed wrong timezone hard */
    if (y >= 1990 && y <= 2100) return ymd(y, mo, day);
  }

  return null;
}

function stripJsonFence(content: string): string {
  const t = content.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return t;
}

function parseOpenAiJson(content: string): ParsedBbsEntry[] {
  let parsed: { entries?: unknown };
  try {
    parsed = JSON.parse(stripJsonFence(content)) as { entries?: unknown };
  } catch {
    return [];
  }
  if (!parsed || !Array.isArray(parsed.entries)) return [];

  const out: ParsedBbsEntry[] = [];
  for (const row of parsed.entries) {
    if (out.length >= MAX_ENTRIES) break;
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const date = normalizeDate(r.date);
    if (!date) continue;
    out.push({
      date,
      individual_supervision_hours: clampHours(r.individual_supervision_hours),
      group_supervision_hours: clampHours(r.group_supervision_hours),
      clinical_hours: clampHours(r.clinical_hours),
      site_name:
        typeof r.site_name === "string" && r.site_name.trim().length > 0
          ? r.site_name.trim().slice(0, 500)
          : null,
    });
  }
  return out;
}

export async function extractBbsEntriesFromText(
  documentText: string,
): Promise<ParsedBbsEntry[]> {
  const openai = new OpenAI({ apiKey: requireOpenAiKey() });
  const text = documentText.slice(0, MAX_PDF_TEXT_CHARS);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Extract rows from this tracking log text:\n\n${text}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];
  return parseOpenAiJson(content);
}

function safePdfFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "document.pdf";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

/**
 * Sends the PDF to the Responses API so OpenAI can use page images (handles scans,
 * handwriting, and BBS forms where pdf text extraction is only the blank template).
 */
export async function extractBbsEntriesFromPdfBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedBbsEntry[]> {
  const openai = new OpenAI({ apiKey: requireOpenAiKey() });
  const safeName = safePdfFileName(fileName);

  const uploaded = await openai.files.create({
    file: await toFile(buffer, safeName, { type: "application/pdf" }),
    purpose: "user_data",
  });

  try {
    const response = await openai.responses.create({
      model: "gpt-4o",
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", file_id: uploaded.id },
            { type: "input_text", text: PDF_USER_INSTRUCTIONS },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "bbs_hour_entries",
          strict: true,
          schema: ENTRIES_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      temperature: 0.1,
    });

    const text = response.output_text?.trim();
    if (!text) return [];
    return parseOpenAiJson(text);
  } finally {
    try {
      await openai.files.delete(uploaded.id);
    } catch {
      /* non-fatal */
    }
  }
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  /* pdf-parse 1.x avoids pdfjs DOM APIs (DOMMatrix) that break in Node / Next server */
  const pdfParse = (await import("pdf-parse")).default as (
    data: Buffer,
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return (data.text ?? "").trim();
}
