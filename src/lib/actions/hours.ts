"use server";

import { revalidatePath } from "next/cache";

import { WEEKLY_CREDIT_CAP } from "@/lib/compliance/bbs-rules";
import type { HourCategoryKey } from "@/lib/hours/categories";
import { HOUR_CATEGORY_KEYS } from "@/lib/hours/categories";
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

function applyWeeklyCap(hours: Record<HourCategoryKey, number>): {
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

  if (rawTotal <= WEEKLY_CREDIT_CAP) {
    return { credited: { ...hours }, rawTotal };
  }

  const scale = WEEKLY_CREDIT_CAP / rawTotal;
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
    Math.round((WEEKLY_CREDIT_CAP - sum) * 100) / 100,
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return { ok: false, message: "Profile not found." };
  }

  const hours = parseHours(rawInput);
  const { credited } = applyWeeklyCap(hours);

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
      organization_id: profile.organization_id,
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
