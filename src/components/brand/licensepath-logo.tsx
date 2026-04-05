"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

const sizes = { sm: 32, md: 40, lg: 52 } as const;

/**
 * Custom mark: path with milestones — suggests progress toward licensure.
 */
export function LicensePathLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: keyof typeof sizes;
}) {
  const gradId = useId().replace(/:/g, "");
  const dim = sizes[size];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={dim}
      height={dim}
      viewBox="0 0 40 40"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={`licensepath-logo-stroke-${gradId}`}
          x1="6"
          y1="31"
          x2="32"
          y2="9"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.85" />
          <stop offset="1" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <path
        d="M8 31.5C11.5 31.5 14 28.2 16.5 23.8 19 19.4 21.8 14.8 26.2 12.4 28.6 11.1 31.2 10 34 9.5"
        stroke={`url(#licensepath-logo-stroke-${gradId})`}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="31.5" r="2.6" fill="currentColor" fillOpacity="0.45" />
      <circle cx="22" cy="17" r="2.15" fill="currentColor" fillOpacity="0.65" />
      <circle cx="34" cy="9.5" r="3" fill="currentColor" />
      <circle cx="34" cy="9.5" r="1.25" className="fill-background" />
    </svg>
  );
}
