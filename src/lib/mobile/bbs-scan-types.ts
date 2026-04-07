/** Shared types/constants for mobile BBS scan (safe for client + server). */

/** Duplicate-image flow from scan extract; keep here — not in `"use server"` files (avoids stale action IDs on the client). */
export const DUPLICATE_SCAN_DOCUMENT_CODE = "duplicate_document" as const;

export const BBS_UPLOADS_BUCKET = "bbs-uploads";

/** PDF weekly logs uploaded from Log hours. */
export const BBS_DOCUMENTS_BUCKET = "bbs-documents";

export const SCAN_LOW_CONFIDENCE_THRESHOLD = 0.72;

export type BbsScanFieldConfidence = {
  date: number;
  clinical: number;
  supervision_individual: number;
  supervision_group: number;
  site: number;
};

export type BbsScanExtractedEntry = {
  work_date: string;
  /** Direct client / clinical counseling contact for the date (not supervision). */
  direct_clinical_counseling_hours: number;
  /** One-to-one, triadic, or “individual” supervision line(s) for that date. */
  individual_supervision_hours: number;
  /** Group supervision only for that date. */
  group_supervision_hours: number;
  supervised_site_name: string | null;
  confidence: BbsScanFieldConfidence;
  clinical_capped: boolean;
};

export type BbsScanConfirmRowInput = {
  work_date: string;
  direct_clinical_counseling_hours: number;
  individual_supervision_hours: number;
  group_supervision_hours: number;
  supervised_site_name: string | null;
};
