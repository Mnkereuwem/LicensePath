import {
  capWeeklyCreditableHours,
  getSunsetDaysRemaining,
  getSunsetEndDate,
} from "@/lib/compliance/bbs-rules";
import { getTrackHourRules } from "@/lib/compliance/track-hour-rules";
import type { DashboardModel } from "@/lib/dashboard/model";
import {
  getLicenseTrackOption,
  normalizeLicenseTrack,
} from "@/lib/licensing/license-tracks";
import { startOfWeekMonday } from "@/lib/dates/week";
import type { HourCategoryKey } from "@/lib/hours/categories";
import {
  buildDeltasByWeekFromParsedBbsEntries,
  mergeWeeklyEntryRowsToMap,
  reportedGridWouldChangeIfSubtracting,
  validateDeltasMatchEntryTotals,
} from "@/lib/hours/bbs-weekly-deltas";
import type { ParsedBbsEntry } from "@/lib/openai/bbs-ocr";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function describeSupabaseError(err: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}): string {
  return [err.message, err.details, err.hint, err.code]
    .filter((s) => typeof s === "string" && s.length > 0)
    .join(" — ");
}

type EntryRow = {
  category: HourCategoryKey;
  hours: number;
  credited_hours: number;
  week_start: string;
};

function sumCategory(
  rows: EntryRow[],
  categories: HourCategoryKey[],
  field: "hours" | "credited_hours",
): number {
  return rows.reduce((acc, r) => {
    if (!categories.includes(r.category)) return acc;
    const v = Number(r[field]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
}

export async function fetchDashboardModel(): Promise<{
  model: DashboardModel | null;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { model: null, warnings };
  }

  const { data: profileLicense } = await supabase
    .from("profiles")
    .select("license_track")
    .eq("id", user.id)
    .maybeSingle();

  const licenseTrack = normalizeLicenseTrack(profileLicense?.license_track);
  const rules = getTrackHourRules(licenseTrack);
  const licenseTrackLabel =
    getLicenseTrackOption(licenseTrack)?.label ?? licenseTrack;

  const { data: rows, error: entriesError } = await supabase
    .from("weekly_hour_entries")
    .select("category, hours, credited_hours, week_start")
    .eq("supervisee_id", user.id);

  let list = (rows ?? []) as EntryRow[];
  if (entriesError) {
    const detail = describeSupabaseError(entriesError);
    warnings.push(
      `Experience hours could not be loaded (${detail || "unknown error"}). If this is a new Supabase project, open the SQL editor and run the files in order under supabase/migrations/.`,
    );
    list = [];
  }
  const now = new Date();
  const weekStart = startOfWeekMonday(now);
  const thisWeek = list.filter((r) => r.week_start === weekStart);

  const faceToFaceCredited = sumCategory(list, ["face_to_face"], "credited_hours");
  const directOtherCredited = sumCategory(list, ["direct_clinical"], "credited_hours");
  const directClinicalCredited = faceToFaceCredited + directOtherCredited;
  const nonClinicalCredited = sumCategory(list, ["non_clinical"], "credited_hours");
  const totalCredited = sumCategory(
    list,
    [
      "direct_clinical",
      "face_to_face",
      "non_clinical",
      "individual_supervision",
      "group_supervision",
      "other",
    ],
    "credited_hours",
  );

  const clinicalHours = sumCategory(
    thisWeek,
    ["direct_clinical", "face_to_face"],
    "hours",
  );
  const individualSupervisionHours = sumCategory(
    thisWeek,
    ["individual_supervision"],
    "hours",
  );
  const groupSupervisionHours = sumCategory(
    thisWeek,
    ["group_supervision"],
    "hours",
  );
  const rawTotalHours = sumCategory(
    thisWeek,
    [
      "direct_clinical",
      "face_to_face",
      "non_clinical",
      "individual_supervision",
      "group_supervision",
      "other",
    ],
    "hours",
  );
  const cappedWeekTotalRaw = sumCategory(
    thisWeek,
    [
      "direct_clinical",
      "face_to_face",
      "non_clinical",
      "individual_supervision",
      "group_supervision",
      "other",
    ],
    "credited_hours",
  );

  const { data: clockRow, error: clockError } = await supabase
    .from("supervisee_license_clocks")
    .select("bbs_registration_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (clockError) {
    const detail = describeSupabaseError(clockError);
    warnings.push(
      `ASW registration date could not be loaded (${detail || "unknown error"}). Dashboard countdown may be wrong until migrations and profile data exist.`,
    );
  }

  const registrationIso = clockRow?.bbs_registration_at ?? now.toISOString().slice(0, 10);
  const registrationDate = new Date(`${registrationIso}T12:00:00`);

  return {
    model: {
      hours: {
        totalCredited,
        directClinicalCredited,
        faceToFaceCredited,
        nonClinicalCredited,
      },
      week: {
        clinicalHours,
        individualSupervisionHours,
        groupSupervisionHours,
        rawTotalHours,
      },
      cappedWeekTotal: capWeeklyCreditableHours(
        cappedWeekTotalRaw,
        rules.weeklyCreditMaxPerWeek,
      ),
      totalProgressPercent: Math.min(
        100,
        Math.round(
          (totalCredited / rules.totalHoursTarget) * 1000,
        ) / 10,
      ),
      licenseTrack,
      licenseTrackLabel,
      weeklyCreditCap: rules.weeklyCreditMaxPerWeek,
      sunsetYears: rules.sunsetYears,
      rulesBlurb: rules.rulesBlurb,
      sunset: {
        registrationDate,
        endDate: getSunsetEndDate(registrationDate, rules.sunsetYears),
        daysRemaining: getSunsetDaysRemaining(
          registrationDate,
          now,
          rules.sunsetYears,
        ),
      },
      targets: {
        total: rules.totalHoursTarget,
        directMin: rules.directClinicalMin,
        faceToFaceMin: rules.faceToFaceMin,
        nonClinicalMax: rules.nonClinicalMax,
      },
    },
    warnings,
  };
}

export async function fetchWeekHourValues(
  weekStart: string,
): Promise<Record<HourCategoryKey, number>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      direct_clinical: 0,
      face_to_face: 0,
      non_clinical: 0,
      individual_supervision: 0,
      group_supervision: 0,
      other: 0,
    };
  }

  const { data, error } = await supabase
    .from("weekly_hour_entries")
    .select("category, hours")
    .eq("supervisee_id", user.id)
    .eq("week_start", weekStart);

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[fetchWeekHourValues]", describeSupabaseError(error));
  }

  const base: Record<HourCategoryKey, number> = {
    direct_clinical: 0,
    face_to_face: 0,
    non_clinical: 0,
    individual_supervision: 0,
    group_supervision: 0,
    other: 0,
  };

  for (const row of data ?? []) {
    const cat = row.category as HourCategoryKey;
    if (cat in base) {
      base[cat] = Number(row.hours) || 0;
    }
  }

  return base;
}

/** Log hours page: week values + track-specific caps copy */
export async function fetchHoursPageContext(weekStart: string): Promise<{
  values: Record<HourCategoryKey, number>;
  weeklyCreditCap: number;
  rulesBlurb: string;
  licenseTrackLabel: string;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const empty: Record<HourCategoryKey, number> = {
    direct_clinical: 0,
    face_to_face: 0,
    non_clinical: 0,
    individual_supervision: 0,
    group_supervision: 0,
    other: 0,
  };

  if (!user) {
    const rules = getTrackHourRules("ca_asw");
    return {
      values: empty,
      weeklyCreditCap: rules.weeklyCreditMaxPerWeek,
      rulesBlurb: rules.rulesBlurb,
      licenseTrackLabel: "California — ASW / ACSW (BBS)",
    };
  }

  const [{ data: profileRow }, { data: weekRows, error }] = await Promise.all([
    supabase.from("profiles").select("license_track").eq("id", user.id).maybeSingle(),
    supabase
      .from("weekly_hour_entries")
      .select("category, hours")
      .eq("supervisee_id", user.id)
      .eq("week_start", weekStart),
  ]);

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[fetchHoursPageContext]", describeSupabaseError(error));
  }

  const base = { ...empty };
  for (const row of weekRows ?? []) {
    const cat = row.category as HourCategoryKey;
    if (cat in base) {
      base[cat] = Number(row.hours) || 0;
    }
  }

  const licenseTrack = normalizeLicenseTrack(profileRow?.license_track);
  const rules = getTrackHourRules(licenseTrack);
  const licenseTrackLabel =
    getLicenseTrackOption(licenseTrack)?.label ?? licenseTrack;

  return {
    values: base,
    weeklyCreditCap: rules.weeklyCreditMaxPerWeek,
    rulesBlurb: rules.rulesBlurb,
    licenseTrackLabel,
  };
}

export type BbsDocumentationListItem = {
  storagePath: string;
  displayName: string;
  lineCount: number;
  sourceKind: "pdf" | "photo";
  firstImportedAt: string;
};

/**
 * One listed document per import that still moves the **hour tracker** (reported
 * weekly grid). Empty tracker → empty list. Orphan `hours_logs` rows (not in grid)
 * are hidden so count stays 1:1 with deletable sources that match progress.
 */
export async function fetchBbsDocumentationList(): Promise<
  BbsDocumentationListItem[]
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: weekRows } = await supabase
    .from("weekly_hour_entries")
    .select("week_start, category, hours, credited_hours")
    .eq("supervisee_id", user.id);

  let totalReported = 0;
  let totalCredited = 0;
  const mergeInput: { week_start: string; category: string; hours: unknown }[] =
    [];
  for (const r of weekRows ?? []) {
    totalReported += Number(r.hours) || 0;
    totalCredited += Number(r.credited_hours) || 0;
    mergeInput.push({
      week_start: r.week_start as string,
      category: r.category as string,
      hours: r.hours,
    });
  }

  if (totalReported <= 0 && totalCredited <= 0) {
    return [];
  }

  const weekToReported = mergeWeeklyEntryRowsToMap(mergeInput);

  const { data: logData, error: logErr } = await supabase
    .from("hours_logs")
    .select(
      "source_storage_path, created_at, work_date, clinical_hours, individual_supervision_hours, group_supervision_hours, site_name",
    )
    .eq("supervisee_id", user.id)
    .not("source_storage_path", "is", null);

  if (logErr || !logData?.length) return [];

  type Agg = {
    entries: ParsedBbsEntry[];
    count: number;
    minAt: string;
  };
  const byPath = new Map<string, Agg>();

  for (const row of logData) {
    const p = row.source_storage_path as string | null;
    if (!p) continue;
    const path = p.trim();
    if (!path) continue;

    const wdRaw = row.work_date as string;
    const date =
      typeof wdRaw === "string"
        ? wdRaw.slice(0, 10)
        : String(wdRaw ?? "").slice(0, 10);

    const entry: ParsedBbsEntry = {
      date,
      clinical_hours: Number(row.clinical_hours) || 0,
      individual_supervision_hours: Number(row.individual_supervision_hours) || 0,
      group_supervision_hours: Number(row.group_supervision_hours) || 0,
      site_name:
        typeof row.site_name === "string" && row.site_name.length > 0
          ? row.site_name
          : null,
    };

    const ca = String(row.created_at ?? "");
    const cur = byPath.get(path);
    if (!cur) {
      byPath.set(path, { entries: [entry], count: 1, minAt: ca });
    } else {
      cur.entries.push(entry);
      cur.count += 1;
      if (ca && ca < cur.minAt) cur.minAt = ca;
    }
  }

  const out: BbsDocumentationListItem[] = [];

  for (const [storagePath, agg] of byPath) {
    const hrSum = agg.entries.reduce(
      (s, e) =>
        s +
        e.clinical_hours +
        e.individual_supervision_hours +
        e.group_supervision_hours,
      0,
    );
    if (hrSum <= 0) continue;

    const deltas = buildDeltasByWeekFromParsedBbsEntries(agg.entries);
    if (deltas.size === 0) continue;

    const consistent = validateDeltasMatchEntryTotals(
      agg.entries,
      deltas,
      "Log",
    );
    if (!consistent.ok) continue;

    if (
      !reportedGridWouldChangeIfSubtracting(weekToReported, deltas)
    ) {
      continue;
    }

    out.push({
      storagePath,
      displayName: storagePath.split("/").pop() ?? storagePath,
      lineCount: agg.count,
      sourceKind: /\.pdf$/i.test(storagePath) ? "pdf" : "photo",
      firstImportedAt: agg.minAt,
    });
  }

  return out.sort((a, b) =>
    a.firstImportedAt < b.firstImportedAt ? 1 : -1,
  );
}
