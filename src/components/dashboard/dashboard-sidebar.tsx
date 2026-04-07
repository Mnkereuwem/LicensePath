"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Camera,
  Clock,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/hours", label: "Log hours", icon: Clock },
  { href: "/dashboard/scan", label: "Scan log", icon: Camera },
  {
    href: "/dashboard/bbs-documentation",
    label: "BBS Documentation",
    icon: FolderOpen,
  },
  {
    href: "/dashboard/upload-calculations",
    label: "Upload math",
    icon: Calculator,
  },
  { href: "/dashboard/exports", label: "BBS exports", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardSidebar({
  className,
  userLabel,
  userEmail,
}: {
  className?: string;
  userLabel: string;
  userEmail: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex h-full w-64 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex min-h-14 items-center border-b border-sidebar-border px-3 py-2.5">
        <BrandMark href="/dashboard" variant="sidebar" className="gap-2.5" />
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="flex flex-col gap-1" aria-label="Main">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="flex flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{userLabel}</p>
          <p className="text-muted-foreground truncate text-xs">{userEmail}</p>
        </div>
        <SignOutButton className="w-full justify-start gap-2 px-2 text-muted-foreground" />
        <p className="text-muted-foreground text-[0.65rem] leading-snug">
          Experience totals are for your tracking only until your board reviews
          your packet.
        </p>
      </div>
    </div>
  );
}
