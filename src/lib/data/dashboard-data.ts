import {
  DIRECT_CLINICAL_MIN,
  FACE_TO_FACE_MIN,
  NON_CLINICAL_MAX,
  TOTAL_HOURS_TARGET,
  capWeeklyCreditableHours,
  formatSupervisionRatioLabel,
  getSunsetDaysRemaining,
  getSunsetEndDate,
  getWeeklySupervisionRatioStatus,
} from "@/lib/compliance/bbs-rules";
import type { DashboardModel } from "@/lib/dashboard/model";
import { startOfWeekMonday } from "@/lib/dates/week";
import type { HourCategoryKey } from "@/lib/hours/categories";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export async function fetchDashboardModel(): Promise<DashboardModel | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows, error: entriesError } = await supabase
    .from("weekly_hour_entries")
    .select("category, hours, credited_hours, week_start");

  if (entriesError) {
    console.error(entriesError);
  }

  const list = (rows ?? []) as EntryRow[];
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

  const ratioStatus = getWeeklySupervisionRatioStatus({
    clinicalHours,
    individualSupervisionHours,
    groupSupervisionHours,
  });

  const { data: clockRow } = await supabase
    .from("supervisee_license_clocks")
    .select("bbs_registration_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  const registrationIso = clockRow?.bbs_registration_at ?? now.toISOString().slice(0, 10);
  const registrationDate = new Date(`${registrationIso}T12:00:00`);

  return {
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
    ratioStatus,
    supervisionLabel: formatSupervisionRatioLabel(ratioStatus),
    cappedWeekTotal: capWeeklyCreditableHours(cappedWeekTotalRaw),
    totalProgressPercent: Math.min(
      100,
      Math.round((totalCredited / TOTAL_HOURS_TARGET) * 1000) / 10,
    ),
    sunset: {
      registrationDate,
      endDate: getSunsetEndDate(registrationDate),
      daysRemaining: getSunsetDaysRemaining(registrationDate, now),
    },
    targets: {
      total: TOTAL_HOURS_TARGET,
      directMin: DIRECT_CLINICAL_MIN,
      faceToFaceMin: FACE_TO_FACE_MIN,
      nonClinicalMax: NON_CLINICAL_MAX,
    },
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

  const { data } = await supabase
    .from("weekly_hour_entries")
    .select("category, hours")
    .eq("supervisee_id", user.id)
    .eq("week_start", weekStart);

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
