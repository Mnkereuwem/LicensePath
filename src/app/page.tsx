import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Lock,
  Shield,
} from "lucide-react";

import { buttonVariants } from "@/lib/button-variants";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let loggedIn = false;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    loggedIn = Boolean(user);
  } catch {
    /* Missing Supabase env or network — treat as logged out */
    loggedIn = false;
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border/60 bg-background/80 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-sm font-semibold tracking-tight"
          >
            <span className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-xl shadow-sm">
              <ClipboardList className="size-4" aria-hidden />
            </span>
            <span className="flex flex-col leading-none">
              <span>LicensePath</span>
              <span className="text-muted-foreground text-[0.65rem] font-normal tracking-normal">
                ASW hours &amp; board readiness
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            {loggedIn ? (
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="border-border/40 relative overflow-hidden border-b">
          <div className="from-primary/[0.07] via-background to-background absolute inset-0 bg-gradient-to-b" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
            <div className="max-w-2xl space-y-6">
              <p className="text-primary text-sm font-semibold tracking-wide uppercase">
                Built for California ASWs
              </p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.1]">
                Hour tracking that respects BBS math, not spreadsheet hope.
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed">
                LicensePath helps Associate Clinical Social Workers log
                experience with guardrails for weekly caps, supervision ratios,
                and the path to 3,000 hours—backed by Supabase auth, Row Level
                Security, and audit-minded exports coming soon.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={loggedIn ? "/dashboard" : "/register"}
                  className={cn(buttonVariants({ size: "lg" }), "h-10 px-6")}
                >
                  {loggedIn ? "Open dashboard" : "Start tracking"}
                </Link>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "h-10 px-6",
                  )}
                >
                  I already have an account
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              What you can do today
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-base">
              Clean dashboards, defensible categories, and a registration clock
              aligned to how boards actually score your packet.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-lg bg-teal-500/10">
                  <ClipboardCheck className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Structured hour entry</CardTitle>
                <CardDescription>
                  Weekly grid with face-to-face, direct clinical, supervision, and
                  non-clinical buckets that map cleanly to how you will present
                  hours.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-lg bg-cyan-500/10">
                  <BarChart3 className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Live compliance cues</CardTitle>
                <CardDescription>
                  Dashboard cards surface total progress toward 3,000 hours, the
                  current week supervision ratio, and a six-year sunset countdown.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-lg bg-slate-500/10">
                  <Shield className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Supabase-native security</CardTitle>
                <CardDescription>
                  Sessions live in secure cookies, data is scoped by RLS, and
                  neither supervisors nor supervisees see client-linked rows
                  without explicit grants.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="bg-muted/30 border-border/60 border-y">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex gap-3">
              <Lock className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  Ready when your project is configured
                </h3>
                <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
                  Point <code className="text-xs">.env.local</code> at your
                  Supabase project and run the SQL migrations in{" "}
                  <code className="text-xs">supabase/migrations</code>. Enable
                  email/password auth (and optional email confirmations) in the
                  Supabase dashboard.
                </p>
              </div>
            </div>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Configure &amp; try it
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-border/60 border-t py-10">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-2 px-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} LicensePath · Experience tracking only</p>
          <p>Not legal advice; verify categories against current BBS regulations.</p>
        </div>
      </footer>
    </div>
  );
}
