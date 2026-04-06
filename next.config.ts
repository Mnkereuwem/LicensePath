import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* pdf-parse 1.x bundles for Node; keep external to avoid Turbopack issues */
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
