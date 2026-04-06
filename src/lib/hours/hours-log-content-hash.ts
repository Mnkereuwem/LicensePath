import type { SupabaseClient } from "@supabase/supabase-js";

export async function countHoursLogsByContentHash(
  supabase: SupabaseClient,
  superviseeId: string,
  contentHash: string,
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await supabase
    .from("hours_logs")
    .select("id", { count: "exact", head: true })
    .eq("supervisee_id", superviseeId)
    .eq("source_content_hash", contentHash);

  if (error) {
    return { count: 0, error: error.message };
  }
  return { count: count ?? 0, error: null };
}
