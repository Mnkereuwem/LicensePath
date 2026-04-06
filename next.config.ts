import type { NextConfig } from "next";

/**
 * Do not set `output: 'export'`: this app relies on Server Actions, dynamic
 * dashboards, Supabase SSR cookies, and middleware. The Capacitor app loads the
 * deployed URL via `capacitor.config.ts` → `server.url`.
 */
const nextConfig: NextConfig = {
  /* pdf-parse 1.x bundles for Node; keep external to avoid Turbopack issues */
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    /**
     * Default Server Action body limit is ~1mb; phone photos exceed that and the client
     * often shows "An unexpected response was received from the server" instead of a
     * clear 413. Match upload cap (~10mb) plus multipart overhead.
     */
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
