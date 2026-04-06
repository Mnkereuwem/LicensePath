import type { ReactNode } from "react";

/**
 * Safe-area + mobile-friendly outer shell for dashboard pages (notches / home indicator).
 */
export function MobileAppLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-0 flex-1"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0px, env(safe-area-inset-left))",
        paddingRight: "max(0px, env(safe-area-inset-right))",
      }}
    >
      <div className="flex w-full min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
