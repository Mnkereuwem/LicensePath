/**
 * Shared compliance types and helpers. Numeric guardrails per credential live in
 * `track-hour-rules.ts` (selected from Settings → license track).
 */

import type { LicenseTrackId } from "@/lib/licensing/license-tracks";

import {
  evaluateWeeklySupervisionGate,
  getTrackHourRules,
  type SupervisionWeekInput,
  type WeeklySupervisionGateStatus,
} from "./track-hour-rules";

export type WeeklySupervisionRatioStatus = WeeklySupervisionGateStatus;

export type WeeklySupervisionInput = SupervisionWeekInput;

/** @deprecated Use getTrackHourRules("ca_asw") for product defaults */
export const TOTAL_HOURS_TARGET = 3000;
/** @deprecated Use getTrackHourRules("ca_asw") */
export const DIRECT_CLINICAL_MIN = 2000;
/** @deprecated Use getTrackHourRules("ca_asw") */
export const FACE_TO_FACE_MIN = 750;
/** @deprecated Use getTrackHourRules("ca_asw") */
export const NON_CLINICAL_MAX = 1000;
/** @deprecated Use getTrackHourRules(track).weeklyCreditMaxPerWeek */
export const WEEKLY_CREDIT_CAP = 40;
/** @deprecated Use getTrackHourRules(track).dailyClinicalHoursMax */
export const BBS_DAILY_CLINICAL_HOURS_MAX = 10;
/** When log lines omit the year, extraction assumes this cycle year. */
export const DEFAULT_EXPERIENCE_YEAR = 2026;
/** @deprecated Use getTrackHourRules(track).sunsetYears */
export const SUNSET_YEARS = 6;

/** @deprecated Use getTrackHourRules(track).weeklySupervisionGate */
export const WEEKLY_INDIVIDUAL_SUPERVISION_MIN = 1;
/** @deprecated Use getTrackHourRules(track).weeklySupervisionGate */
export const WEEKLY_GROUP_SUPERVISION_MIN = 2;

export { evaluateWeeklySupervisionGate, getTrackHourRules };
export type { TrackHourRules } from "./track-hour-rules";

/**
 * Legacy ASW-only helper. Prefer `evaluateWeeklySupervisionGate(week, getTrackHourRules(track).weeklySupervisionGate)`.
 */
export function getWeeklySupervisionRatioStatus(
  week: WeeklySupervisionInput,
): WeeklySupervisionRatioStatus {
  return evaluateWeeklySupervisionGate(
    week,
    getTrackHourRules("ca_asw").weeklySupervisionGate,
  );
}

export function getWeeklySupervisionRatioStatusForTrack(
  week: WeeklySupervisionInput,
  track: LicenseTrackId,
): WeeklySupervisionRatioStatus {
  return evaluateWeeklySupervisionGate(
    week,
    getTrackHourRules(track).weeklySupervisionGate,
  );
}

/** Credit hours toward weekly totals, capped at the track’s regulatory weekly maximum. */
export function capWeeklyCreditableHours(
  hours: number,
  weeklyCap: number,
): number {
  return Math.min(Math.max(hours, 0), weeklyCap);
}

export function getSunsetEndDate(
  registrationDate: Date,
  years: number = SUNSET_YEARS,
): Date {
  const end = new Date(registrationDate);
  end.setFullYear(end.getFullYear() + years);
  return end;
}

export function getSunsetDaysRemaining(
  registrationDate: Date,
  now: Date = new Date(),
  years: number = SUNSET_YEARS,
): number {
  const end = getSunsetEndDate(registrationDate, years);
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function formatSupervisionRatioLabel(
  status: WeeklySupervisionRatioStatus,
): "Valid" | "Invalid" {
  return status === "invalid" ? "Invalid" : "Valid";
}
