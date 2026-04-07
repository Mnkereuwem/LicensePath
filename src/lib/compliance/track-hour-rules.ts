/**
 * Per-credential experience-hour guardrails (weekly caps, daily OCR limits, progress targets).
 * Product defaults for supervised practice—not legal advice; users must verify current board rules.
 */

import type { LicenseTrackId } from "@/lib/licensing/license-tracks";

export type WeeklySupervisionGateStatus =
  | "valid"
  | "invalid"
  | "not_applicable";

export type WeeklySupervisionGate =
  | {
      type: "either_or";
      /** Satisfy if individual hours meet this OR group meets minGroup */
      minIndividual: number;
      minGroup: number;
    }
  | {
      type: "sum_hours";
      /** Satisfy if individual + group >= minSum */
      minSum: number;
    };

export type TrackHourRules = {
  weeklyCreditMaxPerWeek: number;
  /** OCR / line-item guardrail for one calendar day of direct clinical-type hours */
  dailyClinicalHoursMax: number;
  totalHoursTarget: number;
  directClinicalMin: number;
  faceToFaceMin: number;
  nonClinicalMax: number;
  sunsetYears: number;
  weeklySupervisionGate: WeeklySupervisionGate | null;
  /** Copy for dashboard / log hours */
  rulesBlurb: string;
};

const RULES: Record<LicenseTrackId, TrackHourRules> = {
  ca_asw: {
    weeklyCreditMaxPerWeek: 40,
    dailyClinicalHoursMax: 10,
    totalHoursTarget: 3000,
    directClinicalMin: 2000,
    faceToFaceMin: 750,
    nonClinicalMax: 1000,
    sunsetYears: 6,
    weeklySupervisionGate: {
      type: "either_or",
      minIndividual: 1,
      minGroup: 2,
    },
    rulesBlurb:
      "California BBS ASW / ACSW (toward LCSW): 40h/week credit cap, 10h/day clinical line guardrail, and weeks with clinical work expect at least 1h individual or 2h group supervision—matching common BBS weekly log expectations.",
  },
  ca_lmft: {
    weeklyCreditMaxPerWeek: 40,
    dailyClinicalHoursMax: 10,
    totalHoursTarget: 3000,
    directClinicalMin: 1750,
    faceToFaceMin: 750,
    nonClinicalMax: 1100,
    sunsetYears: 6,
    weeklySupervisionGate: {
      type: "either_or",
      minIndividual: 1,
      minGroup: 2,
    },
    rulesBlurb:
      "California BBS MFT track: 40h/week credit ceiling, 10h/day clinical import guardrail, BBS-style supervision checks (1h individual or 2h group in weeks with client contact).",
  },
  ca_lpcc: {
    weeklyCreditMaxPerWeek: 40,
    dailyClinicalHoursMax: 10,
    totalHoursTarget: 3000,
    directClinicalMin: 1900,
    faceToFaceMin: 750,
    nonClinicalMax: 1050,
    sunsetYears: 6,
    weeklySupervisionGate: {
      type: "either_or",
      minIndividual: 1,
      minGroup: 2,
    },
    rulesBlurb:
      "California BBS PCC/LPCC pathway: 40h/week cap, 10h/day OCR guardrail on counseling contact, weekly supervision expectation patterned on BBS worksheets.",
  },
  ny_lmhc: {
    weeklyCreditMaxPerWeek: 35,
    dailyClinicalHoursMax: 10,
    totalHoursTarget: 3500,
    directClinicalMin: 2250,
    faceToFaceMin: 900,
    nonClinicalMax: 600,
    sunsetYears: 6,
    weeklySupervisionGate: { type: "sum_hours", minSum: 2 },
    rulesBlurb:
      "New York LMHC-style planning: 35h/week credit cap (conservative trainee week), 10h/day clinical line cap, and at least 2 combined supervision hours in any week with clinical hours.",
  },
  ny_lcsw: {
    weeklyCreditMaxPerWeek: 40,
    dailyClinicalHoursMax: 10,
    totalHoursTarget: 3500,
    directClinicalMin: 2000,
    faceToFaceMin: 1000,
    nonClinicalMax: 750,
    sunsetYears: 6,
    weeklySupervisionGate: {
      type: "either_or",
      minIndividual: 1,
      minGroup: 2,
    },
    rulesBlurb:
      "New York LCSW pathway: 40h/week credit cap, 10h/day clinical import limit, supervision expectation 1h individual or 2h group when clinical work is logged.",
  },
  tx_lpc: {
    weeklyCreditMaxPerWeek: 40,
    dailyClinicalHoursMax: 12,
    totalHoursTarget: 3000,
    directClinicalMin: 1950,
    faceToFaceMin: 600,
    nonClinicalMax: 900,
    sunsetYears: 5,
    weeklySupervisionGate: { type: "sum_hours", minSum: 1.5 },
    rulesBlurb:
      "Texas LPC intern track: 40h/week cap, 12h/day guardrail (intensive practicum schedules), 5-year planning window, and 1.5h+ combined supervision in weeks with direct client hours.",
  },
};

export function getTrackHourRules(track: LicenseTrackId): TrackHourRules {
  return RULES[track];
}

/** One-line supervision expectation for tables (weeks with clinical hours logged). */
export function formatSupervisionGateShort(
  gate: WeeklySupervisionGate | null,
): string {
  if (!gate) return "—";
  if (gate.type === "either_or") {
    return `${gate.minIndividual}h indiv. or ${gate.minGroup}h group`;
  }
  return `${gate.minSum}h sup. combined`;
}

export type SupervisionWeekInput = {
  clinicalHours: number;
  individualSupervisionHours: number;
  groupSupervisionHours: number;
};

/**
 * Mirrors legacy BBS ASW ratio check but driven by each board’s gate definition.
 */
export function evaluateWeeklySupervisionGate(
  week: SupervisionWeekInput,
  gate: WeeklySupervisionGate | null,
): WeeklySupervisionGateStatus {
  if (!gate) {
    return "not_applicable";
  }
  if (week.clinicalHours <= 0) {
    return "not_applicable";
  }
  const ind = week.individualSupervisionHours;
  const grp = week.groupSupervisionHours;

  if (gate.type === "either_or") {
    const ok =
      ind >= gate.minIndividual || grp >= gate.minGroup;
    return ok ? "valid" : "invalid";
  }

  const sum = ind + grp;
  return sum >= gate.minSum ? "valid" : "invalid";
}
