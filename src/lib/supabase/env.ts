/**
 * Supports legacy `anon` JWT and new `sb_publishable_...` keys.
 * @see https://supabase.com/docs/guides/api/api-keys
 */
export function getSupabasePublicConfig(): {
  url: string;
  anonKey: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";
  return { url, anonKey };
}

export function isSupabasePublicConfigured(): boolean {
  const { url, anonKey } = getSupabasePublicConfig();
  return Boolean(url.length > 0 && anonKey.length > 0);
}
