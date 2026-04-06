/** Shared types/constants for mobile BBS scan (safe for client + server). */

export const BBS_UPLOADS_BUCKET = "bbs-uploads";

export const SCAN_LOW_CONFIDENCE_THRESHOLD = 0.72;

export type BbsScanFieldConfidence = {
  date: number;
  clinical: number;
  supervision: number;
  site: number;
};

export type BbsScanExtractedEntry = {
  work_date: string;
  direct_clinical_counseling_hours: number;
  non_clinical_supervision_hours: number;
  supervised_site_name: string | null;
  confidence: BbsScanFieldConfidence;
  clinical_capped: boolean;
};

export type BbsScanConfirmRowInput = {
  work_date: string;
  direct_clinical_counseling_hours: number;
  non_clinical_supervision_hours: number;
  supervised_site_name: string | null;
};
