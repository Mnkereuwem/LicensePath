import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://license.fyi"),
  title: {
    default: "LicensePath — ASW hour compliance",
    template: "%s · LicensePath",
  },
  description:
    "Hours tracking for California Associate Clinical Social Workers—structured categories, weekly caps, and supervision cues. license.fyi",
  openGraph: {
    title: "LicensePath — ASW hour compliance",
    description:
      "Structured hour logging for California ASWs on the path to LCSW. license.fyi",
    url: "https://license.fyi",
    siteName: "LicensePath",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LicensePath — ASW hour compliance",
    description:
      "Structured hour logging for California ASWs. license.fyi",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
