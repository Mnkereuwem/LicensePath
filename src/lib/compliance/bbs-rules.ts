/**
 * CA BBS / ASWB-oriented hour rules for Associate Clinical Social Worker (ASW)
 * experience tracking. Tune thresholds with counsel; this module encodes product guardrails.
 */

export const TOTAL_HOURS_TARGET = 3000;
export const DIRECT_CLINICAL_MIN = 2000;
export const FACE_TO_FACE_MIN = 750;
export const NON_CLINICAL_MAX = 1000;
export const WEEKLY_CREDIT_CAP = 40;

/**
 * ASW weekly log shows max 40h/week; guardrail for OCR line items so a single day’s
 * “direct clinical / counseling” bucket does not explode. Tune with counsel.
 */
export const BBS_DAILY_CLINICAL_HOURS_MAX = 10;

/** When log lines omit the year, extraction assumes this cycle year (user request). */
export const DEFAULT_EXPERIENCE_YEAR = 2026;
export const SUNSET_YEARS = 6;

/** Minimum individual supervision hours per week when clinical hours are logged. */
export const WEEKLY_INDIVIDUAL_SUPERVISION_MIN = 1;
/** Minimum group supervision hours per week when clinical hours are logged. */
export const WEEKLY_GROUP_SUPERVISION_MIN = 2;

export type WeeklySupervisionRatioStatus =
  | "valid"
  | "invalid"
  /** No clinical hours this week — ratio requirement not triggered. */
  | "not_applicable";

export type WeeklySupervisionInput = {
  clinicalHours: number;
  individualSupervisionHours: number;
  groupSupervisionHours: number;
};

/**
 * If any clinical hours are logged in the week, the week is credit-complete for supervision ratio
 * only when at least 1h individual OR 2h group supervision is recorded.
 */
export function getWeeklySupervisionRatioStatus(
  week: WeeklySupervisionInput,
): WeeklySupervisionRatioStatus {
  if (week.clinicalHours <= 0) {
    return "not_applicable";
  }
  const meetsIndividual =
    week.individualSupervisionHours >= WEEKLY_INDIVIDUAL_SUPERVISION_MIN;
  const meetsGroup =
    week.groupSupervisionHours >= WEEKLY_GROUP_SUPERVISION_MIN;
  if (meetsIndividual || meetsGroup) {
    return "valid";
  }
  return "invalid";
}

export function formatSupervisionRatioLabel(
  status: WeeklySupervisionRatioStatus,
): "Valid" | "Invalid" {
  return status === "invalid" ? "Invalid" : "Valid";
}

/** Credit hours toward weekly totals, capped at the regulatory weekly maximum. */
export function capWeeklyCreditableHours(hours: number): number {
  return Math.min(Math.max(hours, 0), WEEKLY_CREDIT_CAP);
}

export function getSunsetEndDate(registrationDate: Date): Date {
  const end = new Date(registrationDate);
  end.setFullYear(end.getFullYear() + SUNSET_YEARS);
  return end;
}

export function getSunsetDaysRemaining(
  registrationDate: Date,
  now: Date = new Date(),
): number {
  const end = getSunsetEndDate(registrationDate);
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
