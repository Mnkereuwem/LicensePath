import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/supabase/env";

export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabasePublicConfig();

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or a publishable / anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
    );
  }

  return createBrowserClient(url, anonKey);
}
