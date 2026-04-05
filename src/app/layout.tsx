import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://license.fyi"),
  title: {
    default: "License FYI — ASW hour compliance",
    template: "%s · License FYI",
  },
  description:
    "Hours tracking for California Associate Clinical Social Workers—structured categories, weekly caps, and supervision cues. license.fyi",
  openGraph: {
    title: "License FYI — ASW hour compliance",
    description:
      "Structured hour logging for California ASWs on the path to LCSW. license.fyi",
    url: "https://license.fyi",
    siteName: "License FYI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "License FYI — ASW hour compliance",
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
