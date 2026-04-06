import "server-only";

import OpenAI from "openai";

export type ParsedBbsEntry = {
  date: string;
  individual_supervision_hours: number;
  group_supervision_hours: number;
  clinical_hours: number;
  site_name: string | null;
};

const SYSTEM_PROMPT = `You extract structured hour data from California BBS-style experience tracking forms (weekly logs, supervision sheets, agency templates).

Return a single JSON object with key "entries" whose value is an array. Each item must have:
- "date": string in YYYY-MM-DD (infer year from context if only month/day shown; prefer the most recent reasonable year if ambiguous)
- "individual_supervision_hours": number (individual / 1:1 supervision hours for that date; 0 if none stated)
- "group_supervision_hours": number (group supervision hours; 0 if none)
- "clinical_hours": number (direct clinical / client-contact hours listed for that date, if any; else 0)
- "site_name": string or null (employer, site, program name if visible)

Rules:
- Use numbers only (not strings) for hour fields. Decimals allowed.
- If the document lists one week, emit one entry per row/date shown (max 50 entries).
- If you cannot parse any rows, return {"entries": []}.
- Do not invent dates; skip illegible rows.
- Output JSON only, no markdown.`;

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

function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseOpenAiJson(content: string): ParsedBbsEntry[] {
  const parsed = JSON.parse(content) as { entries?: unknown };
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

export async function extractBbsEntriesFromImageDataUrl(
  dataUrl: string,
): Promise<ParsedBbsEntry[]> {
  const openai = new OpenAI({ apiKey: requireOpenAiKey() });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read this document image and extract all day rows into the JSON schema described.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];
  return parseOpenAiJson(content);
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

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  /* pdf-parse 1.x avoids pdfjs DOM APIs (DOMMatrix) that break in Node / Next server */
  const pdfParse = (await import("pdf-parse")).default as (
    data: Buffer,
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return (data.text ?? "").trim();
}
