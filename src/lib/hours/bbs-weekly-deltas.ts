import { startOfWeekMonday } from "@/lib/dates/week";
import type { ParsedBbsEntry } from "@/lib/openai/bbs-ocr";

import {
  emptyHourRecord,
  HOUR_CATEGORY_KEYS,
  type HourCategoryKey,
} from "./categories";

/** Per-week totals from BBS log lines (clinical → direct_clinical only). */
export function buildDeltasByWeekFromParsedBbsEntries(
  entries: ParsedBbsEntry[],
): Map<string, Record<HourCategoryKey, number>> {
  const deltasByWeek = new Map<string, Record<HourCategoryKey, number>>();
  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const weekStart = startOfWeekMonday(new Date(`${e.date}T12:00:00`));
    if (!deltasByWeek.has(weekStart)) {
      deltasByWeek.set(weekStart, emptyHourRecord());
    }
    const d = deltasByWeek.get(weekStart)!;
    d.individual_supervision += e.individual_supervision_hours;
    d.group_supervision += e.group_supervision_hours;
    d.direct_clinical += e.clinical_hours;
  }
  for (const [, delta] of deltasByWeek) {
    for (const k of HOUR_CATEGORY_KEYS) {
      delta[k] = Math.round(delta[k] * 100) / 100;
    }
  }
  return deltasByWeek;
}

export function validateDeltasMatchEntryTotals(
  entries: ParsedBbsEntry[],
  deltasByWeek: Map<string, Record<HourCategoryKey, number>>,
  label: string,
): { ok: true } | { ok: false; message: string } {
  for (const [weekStart, delta] of deltasByWeek) {
    const sumRow = emptyHourRecord();
    for (const e of entries) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
      const ws = startOfWeekMonday(new Date(`${e.date}T12:00:00`));
      if (ws !== weekStart) continue;
      sumRow.individual_supervision += e.individual_supervision_hours;
      sumRow.group_supervision += e.group_supervision_hours;
      sumRow.direct_clinical += e.clinical_hours;
    }
    for (const k of HOUR_CATEGORY_KEYS) {
      sumRow[k] = Math.round(sumRow[k] * 100) / 100;
    }
    const TOL = 0.02;
    for (const k of HOUR_CATEGORY_KEYS) {
      if (Math.abs(sumRow[k] - delta[k]) > TOL) {
        return {
          ok: false,
          message: `${label} rows for week starting ${weekStart} do not add up (${k}: ${sumRow[k]} vs ${delta[k]}). Nothing was changed.`,
        };
      }
    }
  }
  return { ok: true };
}

/** Merge DB rows into week_start → category hours (one row per category per week). */
export function mergeWeeklyEntryRowsToMap(
  rows: { week_start: string; category: string; hours: unknown }[],
): Map<string, Record<HourCategoryKey, number>> {
  const weekToReported = new Map<string, Record<HourCategoryKey, number>>();
  for (const row of rows) {
    const ws = row.week_start as string;
    if (!weekToReported.has(ws)) {
      weekToReported.set(ws, emptyHourRecord());
    }
    const k = row.category as HourCategoryKey;
    const m = weekToReported.get(ws)!;
    if (k in m) {
      m[k] = Number(row.hours) || 0;
    }
  }
  return weekToReported;
}

/**
 * True if subtracting these import deltas from the current **reported** weekly grid
 * would change any category. If false, the import is not reflected in the tracker (orphan).
 */
export function reportedGridWouldChangeIfSubtracting(
  weekToReported: Map<string, Record<HourCategoryKey, number>>,
  deltasByWeek: Map<string, Record<HourCategoryKey, number>>,
): boolean {
  const EPS = 0.02;
  for (const [weekStart, delta] of deltasByWeek) {
    const existing = weekToReported.get(weekStart) ?? emptyHourRecord();
    for (const k of HOUR_CATEGORY_KEYS) {
      const next = Math.max(
        0,
        Math.round((existing[k] - delta[k]) * 100) / 100,
      );
      if (Math.abs(next - existing[k]) > EPS) return true;
    }
  }
  return false;
}
