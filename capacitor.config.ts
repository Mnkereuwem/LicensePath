import type { CapacitorConfig } from "@capacitor/cli";

/**
 * LicensePath hybrid shell: native WebView loads your deployed Next.js app
 * (Server Actions + Supabase auth require a live server).
 *
 * Dev: CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000 npx cap run ios
 * Prod: ship with your production URL (default below).
 *
 * `output: 'export'` in Next.js is NOT compatible with Server Actions / SSR auth —
 * keep the standard Next build and point `server.url` here instead.
 */
const config: CapacitorConfig = {
  appId: "com.licensepath.app",
  appName: "LicensePath",
  webDir: "www",
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? "https://license.fyi",
    cleartext: true,
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
