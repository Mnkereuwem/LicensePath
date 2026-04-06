"use client";

import { Menu } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function DashboardShell({
  children,
  userLabel,
  userEmail,
}: {
  children: React.ReactNode;
  userLabel: string;
  userEmail: string;
}) {
  return (
    <div className="bg-background flex min-h-screen w-full">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:border-r">
        <DashboardSidebar userLabel={userLabel} userEmail={userEmail} />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header
          className="bg-background/85 supports-backdrop-filter:bg-background/65 sticky top-0 z-40 flex min-h-14 items-center gap-2 border-b px-3 pt-[max(0px,env(safe-area-inset-top))] backdrop-blur-md md:hidden"
        >
          <Sheet>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "icon" }),
              )}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100%,20rem)] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <DashboardSidebar
                className="w-full border-0"
                userLabel={userLabel}
                userEmail={userEmail}
              />
            </SheetContent>
          </Sheet>
          <BrandMark
            href="/dashboard"
            variant="compact"
            showTagline={false}
            className="min-w-0 shrink"
          />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
