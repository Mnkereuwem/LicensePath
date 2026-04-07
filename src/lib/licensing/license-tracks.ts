/**
 * User-selected credential / board context for AI hour-log reading (camera + PDF).
 * Not legal advice; prompts orient the model toward common supervision-hour worksheet layouts.
 */

export const LICENSE_TRACK_IDS = [
  "ca_asw",
  "ca_lmft",
  "ca_lpcc",
  "ny_lmhc",
  "ny_lcsw",
  "tx_lpc",
] as const;

export type LicenseTrackId = (typeof LICENSE_TRACK_IDS)[number];

export const DEFAULT_LICENSE_TRACK: LicenseTrackId = "ca_asw";

export function isLicenseTrackId(v: string): v is LicenseTrackId {
  return (LICENSE_TRACK_IDS as readonly string[]).includes(v);
}

export function normalizeLicenseTrack(
  raw: string | null | undefined,
): LicenseTrackId {
  if (raw && isLicenseTrackId(raw)) return raw;
  return DEFAULT_LICENSE_TRACK;
}

export type LicenseTrackOption = {
  id: LicenseTrackId;
  /** Short label for selects */
  label: string;
  /** Secondary line: state + abbreviation */
  subtitle: string;
  /** Homepage / marketing one-liner */
  blurb: string;
};

export const LICENSE_TRACK_OPTIONS: readonly LicenseTrackOption[] = [
  {
    id: "ca_asw",
    label: "California — ASW / ACSW (BBS)",
    subtitle: "Associate Clinical Social Worker · Board of Behavioral Sciences",
    blurb:
      "Weekly experience logs (e.g. 37A-638 style), training program grids, and similar BBS-oriented worksheets.",
  },
  {
    id: "ca_lmft",
    label: "California — LMFT (trainee / licensing track)",
    subtitle: "Marriage and Family Therapist · BBS",
    blurb:
      "MFT practicum / experience logs, BBS-style hour summaries, and agency weekly sheets used toward LMFT licensure.",
  },
  {
    id: "ca_lpcc",
    label: "California — LPCC",
    subtitle: "Licensed Professional Clinical Counselor · BBS",
    blurb:
      "PCC trainee and clinical hour logs, counseling experience worksheets, and weekly summaries toward LPCC.",
  },
  {
    id: "ny_lmhc",
    label: "New York — LMHC",
    subtitle: "Licensed Mental Health Counselor · OPRA / NYSED",
    blurb:
      "Experience hours logs, supervised practice summaries, and internship / practicum weekly forms used toward LMHC.",
  },
  {
    id: "ny_lcsw",
    label: "New York — LCSW",
    subtitle: "Licensed Clinical Social Worker · NYSED",
    blurb:
      "CSW supervised experience documentation, generalist / clinical hour logs, and LCSW qualifying weekly summaries.",
  },
  {
    id: "tx_lpc",
    label: "Texas — LPC",
    subtitle: "Licensed Professional Counselor · Texas",
    blurb:
      "Supervised practicum logs, counseling experience tracking sheets, and weekly hour forms toward LPC in Texas.",
  },
] as const;

export function getLicenseTrackOption(
  id: LicenseTrackId,
): LicenseTrackOption | undefined {
  return LICENSE_TRACK_OPTIONS.find((o) => o.id === id);
}

/** Vision (camera) system prompt fragment per track — full system string assembled in bbs-scan-extract */
export function buildScanVisionBoardContext(track: LicenseTrackId): string {
  const blocks: Record<LicenseTrackId, string> = {
    ca_asw: `Document context: California BBS Associate Clinical Social Worker (ASW) experience. Expect California DCA BBS weekly logs (e.g. 37A-638), “Week of” columns, supervision rows (individual/triadic, group), and clinical / psychosocial hours. Letters like A, A1, B, C may appear—read the form’s own totals and do not double-count.`,
    ca_lmft: `Document context: California Board of Behavioral Sciences — Marriage and Family Therapist licensing path. Expect MFT trainee / registered associate hour logs, weekly summaries, site supervision notes, and BBS-style category splits (direct client contact vs supervision). Handwritten site names and dates are common.`,
    ca_lpcc: `Document context: California BBS — Licensed Professional Clinical Counselor pathway (PCC / counselor trainee logs). Expect clinical counseling contact hours, non-clinical and supervision lines, practicum grids, and employer-signed weekly forms similar to other BBS professions.`,
    ny_lmhc: `Document context: New York State — Licensed Mental Health Counselor (LMHC) qualifying experience. Expect supervised mental health counseling logs, OPES-style or university / agency weekly summaries, category labels for direct service vs supervision, and internship hour grids.`,
    ny_lcsw: `Document context: New York State — Clinical Social Work (LCSW) qualifying hours. Expect supervised practice experience logs, generalist/clinical activity summaries, MSW field placement sheets, and weekly totals with supervision broken out where shown.`,
    tx_lpc: `Document context: Texas — Licensed Professional Counselor (LPC) supervised experience. Expect LPC-associate / intern logs, board-rule-oriented hour tracking, weekly supervision + direct client service columns, and employer or supervisor sign-off blocks.`,
  };
  return blocks[track];
}

/** Full vision system prompt (JSON schema instructions + board context) */
export function buildScanVisionSystemPrompt(params: {
  track: LicenseTrackId;
  defaultExperienceYear: number;
}): string {
  const ctx = buildScanVisionBoardContext(params.track);
  return `${ctx}

You are reading a photograph of a handwritten or printed supervision / experience hour log (often a weekly grid: days as rows or columns).

Output JSON only (no markdown) with key "entries": array (max 15). One entry per calendar date that has any hours or a clearly labeled day in a dated row/column.

Each entry MUST include:
- "work_date": string — the service date for that cell in YYYY-MM-DD. If the form shows only month/day, use year ${params.defaultExperienceYear}. For US-style BBS worksheets (month before day when ambiguous), interpret "3/5" as March 5 unless the form explicitly uses day-first. If a "Week of Monday MM/DD/YY" header applies, assign each daily column that week’s calendar date (Mon–Fri).
- "direct_clinical_counseling_hours": number — hours in the direct client / clinical counseling / psychotherapy / “client contact” columns ONLY. Do NOT add supervision hours here. Use 0 if blank or dash.
- "individual_supervision_hours": number — one-to-one, individual, or triadic supervision (sometimes labeled A, individual, 1:1). Use 0 if blank.
- "group_supervision_hours": number — group supervision only. Use 0 if blank.
- "supervised_site_name": string or null — site/agency/program if visible that day.
- "confidence": object with numbers 0–1 for: "date", "clinical", "supervision_individual", "supervision_group", "site".

Rules:
- Never sum individual and group into one number — keep them separate.
- If the form has a single “supervision” column with no split, put the whole value in "individual_supervision_hours" and 0 in group unless the row label says “group”.
- Hours are numeric decimals; blank/dash → 0.
- Do not invent dates; skip illegible rows.
- If nothing is legible return {"entries": []}.`;
}

/** PDF + text OCR: system prompt */
export function buildPdfOcrSystemPrompt(track: LicenseTrackId): string {
  const ctx = buildScanVisionBoardContext(track);
  return `You extract structured hour data from licensed mental health professionals’ experience-tracking documents.

${ctx}

Mapping to output fields (same schema for every document):
- individual_supervision_hours: one-to-one, triadic, or “individual” supervision hours for that week/date.
- group_supervision_hours: group supervision for that week/date.
- clinical_hours: direct clinical / client-contact / qualifying non-supervision hours for that week (sum sub-rows if the form splits them, excluding pure supervision lines).

Return one JSON object with key "entries" (array, max 50). Each item:
- "date": calendar date YYYY-MM-DD (normalize US-style dates you read).
- "individual_supervision_hours", "group_supervision_hours", "clinical_hours": numbers (0 if blank).
- "site_name": worksite / employer / program name if visible, else empty string.

Rules:
- Read printed text, typing, and handwriting.
- Hour values numeric only (decimals ok). Blank or dash → 0.
- One entry per distinct week/date column (or dated row) with any hours > 0 or a clear week date—skip empty columns.
- Do not invent dates. Skip illegible rows.
- If nothing is filled or legible, return {"entries": []}.
- Output must match the requested JSON shape exactly.`;
}

export function buildPdfOcrUserInstructions(track: LicenseTrackId): string {
  const extras: Record<LicenseTrackId, string> = {
    ca_asw:
      "This PDF is a California BBS ASW weekly log, supervision sheet, or similar. Use the full layout (including scans and handwriting).",
    ca_lmft:
      "This PDF is a California MFT trainee / licensing hour log or weekly summary. Extract each week or dated block into the schema.",
    ca_lpcc:
      "This PDF is a California professional clinical counselor trainee or licensing hour log. Extract weekly or dated totals.",
    ny_lmhc:
      "This PDF is a New York LMHC qualifying experience or supervision log. Extract each week or service period.",
    ny_lcsw:
      "This PDF is a New York LCSW qualifying supervised experience log or weekly summary.",
    tx_lpc:
      "This PDF is a Texas LPC supervised experience or practicum log.",
  };
  return `${extras[track]} Merge all pages into one entries list. Use “Week of” / week columns or dated rows as the date for each entry.`;
}
