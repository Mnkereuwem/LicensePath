"use server";

import { revalidatePath } from "next/cache";

import { getTrackHourRules } from "@/lib/compliance/track-hour-rules";
import { normalizeLicenseTrack } from "@/lib/licensing/license-tracks";
import { startOfWeekMonday } from "@/lib/dates/week";
import type { HourCategoryKey } from "@/lib/hours/categories";
import { emptyHourRecord, HOUR_CATEGORY_KEYS } from "@/lib/hours/categories";
import type { ParsedBbsEntry } from "@/lib/openai/bbs-ocr";
import { ensureProfileForUser } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function parseHours(input: Record<string, unknown>): Record<HourCategoryKey, number> {
  const out = {} as Record<HourCategoryKey, number>;
  for (const key of HOUR_CATEGORY_KEYS) {
    const raw = input[key];
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseFloat(raw)
          : 0;
    const v = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
    out[key] = v;
  }
  return out;
}

function applyWeeklyCap(
  hours: Record<HourCategoryKey, number>,
  weeklyCreditMax: number,
): {
  credited: Record<HourCategoryKey, number>;
  rawTotal: number;
} {
  const rawTotal = HOUR_CATEGORY_KEYS.reduce((s, k) => s + hours[k], 0);
  if (rawTotal <= 0) {
    return {
      credited: Object.fromEntries(HOUR_CATEGORY_KEYS.map((k) => [k, 0])) as Record<
        HourCategoryKey,
        number
      >,
      rawTotal: 0,
    };
  }

  if (rawTotal <= weeklyCreditMax) {
    return { credited: { ...hours }, rawTotal };
  }

  const scale = weeklyCreditMax / rawTotal;
  const credited = {} as Record<HourCategoryKey, number>;
  let sum = 0;
  for (let i = 0; i < HOUR_CATEGORY_KEYS.length - 1; i++) {
    const k = HOUR_CATEGORY_KEYS[i];
    const c = Math.round(hours[k] * scale * 100) / 100;
    credited[k] = c;
    sum += c;
  }
  const lastKey = HOUR_CATEGORY_KEYS[HOUR_CATEGORY_KEYS.length - 1]!;
  credited[lastKey] = Math.max(
    0,
    Math.round((weeklyCreditMax - sum) * 100) / 100,
  );

  return { credited, rawTotal };
}

export async function saveWeekHours(
  weekStart: string,
  rawInput: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return { ok: false, message: "Invalid week." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, license_track")
    .eq("id", user.id)
    .maybeSingle();

  let organizationId = profile?.organization_id ?? null;

  if (profileError || !organizationId) {
    const fixed = await ensureProfileForUser(user);
    if (!fixed.ok) {
      return { ok: false, message: fixed.message };
    }
    organizationId = fixed.organizationId;
  }

  if (!organizationId) {
    return {
      ok: false,
      message:
        "Profile not found after setup. Run the SQL migrations in supabase/migrations/ on your Supabase project.",
    };
  }

  const rules = getTrackHourRules(normalizeLicenseTrack(profile?.license_track));
  const hours = parseHours(rawInput);
  const { credited } = applyWeeklyCap(hours, rules.weeklyCreditMaxPerWeek);

  for (const key of HOUR_CATEGORY_KEYS) {
    const h = hours[key];
    if (h <= 0) {
      const { error: delErr } = await supabase
        .from("weekly_hour_entries")
        .delete()
        .eq("supervisee_id", user.id)
        .eq("week_start", weekStart)
        .eq("category", key);
      if (delErr) {
        return { ok: false, message: delErr.message };
      }
      continue;
    }

    const row = {
      organization_id: organizationId,
      supervisee_id: user.id,
      week_start: weekStart,
      category: key,
      hours: h,
      credited_hours: credited[key],
    };

    const { error: upErr } = await supabase.from("weekly_hour_entries").upsert(row, {
      onConflict: "supervisee_id,week_start,category",
    });
    if (upErr) {
      return { ok: false, message: upErr.message };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/hours");
  return { ok: true };
}

/**
 * Adds OCR / BBS log line items into `weekly_hour_entries` so the dashboard and log
 * hours page show imported time. Sums with any existing values for that week.
 * Clinical hours from the log (no F2F split) go to `direct_clinical`.
 */
export async function addParsedBbsEntriesToWeeklyGrid(
  entries: ParsedBbsEntry[],
): Promise<
  { ok: true; weeksTouched: string[] } | { ok: false; message: string }
> {
  if (entries.length === 0) {
    return { ok: true, weeksTouched: [] };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, license_track")
    .eq("id", user.id)
    .maybeSingle();

  let organizationId = profile?.organization_id ?? null;
  if (profileError || !organizationId) {
    const fixed = await ensureProfileForUser(user);
    if (!fixed.ok) {
      return { ok: false, message: fixed.message };
    }
    organizationId = fixed.organizationId;
  }

  if (!organizationId) {
    return {
      ok: false,
      message:
        "Profile not found after setup. Run the SQL migrations in supabase/migrations/ on your Supabase project.",
    };
  }

  const rules = getTrackHourRules(normalizeLicenseTrack(profile?.license_track));

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
          message: `Imported rows for week starting ${weekStart} do not add up (${k}: ${sumRow[k]} vs ${delta[k]}). Nothing was changed.`,
        };
      }
    }
  }

  const weeksTouched: string[] = [];

  for (const [weekStart, delta] of deltasByWeek) {
    const { data: existingRows, error: fetchErr } = await supabase
      .from("weekly_hour_entries")
      .select("category, hours")
      .eq("supervisee_id", user.id)
      .eq("week_start", weekStart);

    if (fetchErr) {
      return { ok: false, message: fetchErr.message };
    }

    const merged = emptyHourRecord();
    for (const row of existingRows ?? []) {
      const k = row.category as HourCategoryKey;
      if (k in merged) {
        merged[k] = Number(row.hours) || 0;
      }
    }
    for (const k of HOUR_CATEGORY_KEYS) {
      merged[k] = Math.round((merged[k] + delta[k]) * 100) / 100;
    }

    const { credited } = applyWeeklyCap(merged, rules.weeklyCreditMaxPerWeek);

    for (const key of HOUR_CATEGORY_KEYS) {
      const h = merged[key];
      if (h <= 0) {
        const { error: delErr } = await supabase
          .from("weekly_hour_entries")
          .delete()
          .eq("supervisee_id", user.id)
          .eq("week_start", weekStart)
          .eq("category", key);
        if (delErr) {
          return { ok: false, message: delErr.message };
        }
        continue;
      }

      const row = {
        organization_id: organizationId,
        supervisee_id: user.id,
        week_start: weekStart,
        category: key,
        hours: h,
        credited_hours: credited[key],
      };

      const { error: upErr } = await supabase.from("weekly_hour_entries").upsert(row, {
        onConflict: "supervisee_id,week_start,category",
      });
      if (upErr) {
        return { ok: false, message: upErr.message };
      }
    }

    weeksTouched.push(weekStart);
  }

  weeksTouched.sort();
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/hours");
  return { ok: true, weeksTouched };
}
