import Link from "next/link";

import { cn } from "@/lib/utils";

import { LicensePathLogo } from "./licensepath-logo";

type BrandMarkProps = {
  /** Use `""` for a static mark (no link). Default `"/"`. */
  href?: string;
  className?: string;
  /** Compact: nav / sidebar. Hero: marketing headline scale. */
  variant?: "compact" | "hero" | "sidebar";
  /** Second line under the wordmark (e.g. off on tight mobile headers). */
  showTagline?: boolean;
};

export function BrandMark({
  href = "/",
  className,
  variant = "compact",
  showTagline = true,
}: BrandMarkProps) {
  const isLinked = href.length > 0;
  const isHero = variant === "hero";
  const isSidebar = variant === "sidebar";

  const logoSize = isHero ? "lg" : isSidebar ? "md" : "md";
  const boxClass = isHero
    ? "size-12 rounded-2xl shadow-md shadow-primary/25 ring-1 ring-primary/20"
    : isSidebar
      ? "size-9 rounded-xl shadow-sm ring-1 ring-primary/15"
      : "size-10 rounded-xl shadow-sm ring-1 ring-primary/15";

  const titleClass = isHero
    ? "font-heading text-xl font-semibold tracking-tight sm:text-2xl"
    : isSidebar
      ? "font-heading text-base font-semibold tracking-tight"
      : "font-heading text-base font-semibold tracking-tight sm:text-lg";

  const inner = (
    <>
      <span
        className={cn(
          "bg-primary text-primary-foreground inline-flex shrink-0 items-center justify-center",
          boxClass,
        )}
      >
        <LicensePathLogo size={logoSize} />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className={titleClass}>LicensePath</span>
        {showTagline ? (
          <span
            className={cn(
              "text-muted-foreground font-normal tracking-normal",
              isHero
                ? "mt-1 text-xs sm:text-sm"
                : "mt-0.5 text-[0.65rem] sm:text-xs",
            )}
          >
            {isHero
              ? "ASW hours & board readiness"
              : "ASW hour compliance"}
          </span>
        ) : null}
      </span>
    </>
  );

  const wrapClass = cn(
    "text-foreground flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90",
    isHero && "gap-4",
    className,
  );

  if (isLinked) {
    return (
      <Link href={href} className={wrapClass}>
        {inner}
      </Link>
    );
  }

  return <div className={wrapClass}>{inner}</div>;
}
