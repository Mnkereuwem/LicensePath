import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  Lock,
  ScanLine,
  Shield,
  UserRound,
  Users,
} from "lucide-react";

import { LICENSE_TRACK_OPTIONS } from "@/lib/licensing/license-tracks";

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
      <header className="border-border/50 bg-background/85 supports-backdrop-filter:bg-background/70 sticky top-0 z-20 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandMark variant="compact" />
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
          <div className="from-primary/[0.12] via-primary/[0.04] to-background pointer-events-none absolute inset-0 bg-gradient-to-b" />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
            <div className="mb-10 sm:mb-12">
              <BrandMark variant="hero" className="max-w-xl" href="" />
            </div>
            <div className="max-w-3xl space-y-6">
              <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
                Multi-state · AI hour-log reader
              </p>
              <h1 className="font-heading text-foreground text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.08] lg:text-7xl lg:leading-[1.06]">
                Hour tracking and documentation that fit your board—not a
                generic timesheet.
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed">
                License FYI is built for mental health licensing paths in{" "}
                <span className="text-foreground font-medium">
                  California, New York, and Texas
                </span>
                : pick your credential in settings, then use structured weekly
                entry plus an{" "}
                <span className="text-foreground font-medium">
                  AI-powered reader
                </span>{" "}
                that interprets photos and PDFs of board-style hour logs
                (GPT‑4o vision). Supabase auth and Row Level Security keep data
                scoped to you.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Supported tracks include{" "}
                {LICENSE_TRACK_OPTIONS.filter((o) => o.id !== "ca_asw").map((o, i, a) => (
                  <span key={o.id}>
                    {o.label.replace(/^California — |^New York — |^Texas — /, "")}
                    {i < a.length - 1 ? " · " : ""}
                  </span>
                ))}{" "}
                and California ASW/ACSW (BBS)—each with prompts tuned to typical
                worksheets for that board.
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
            <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-4xl">
              What you can do today
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-base">
              Dashboards, weekly caps, and an optional AI pass over your paper or
              PDF logs—always with human review before anything is saved.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 bg-card/80 shadow-lg shadow-black/20">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
                  <ScanLine className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">AI documentation reader</CardTitle>
                <CardDescription>
                  Photograph a weekly log or upload a PDF; the model reads
                  dates, supervision, and clinical hours using your selected
                  license track. You preview and confirm before rows hit your
                  progress.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-lg shadow-black/20">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
                  <ClipboardCheck className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Structured hour entry</CardTitle>
                <CardDescription>
                  Weekly grid with categories that roll up for reporting—tuned
                  for BBS-style paths and compatible with other board workflows
                  in the app today.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-lg shadow-black/20">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-xl bg-chart-2/15 ring-1 ring-chart-2/25">
                  <BarChart3 className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Live progress cues</CardTitle>
                <CardDescription>
                  Dashboard cards surface hours toward typical licensure targets
                  (e.g. 3,000-hour contexts), weekly credit limits, and
                  registration or experience clocks where applicable.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-lg shadow-black/20">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-xl bg-muted ring-1 ring-border">
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

        <section className="border-border/40 border-b">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mb-10 max-w-3xl">
              <p className="text-primary mb-3 text-sm font-semibold tracking-[0.18em] uppercase">
                Why sloppy tracking hurts
              </p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-4xl">
                Hours problems real supervisees run into
              </h2>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed sm:text-base">
                These are common patterns—not specific cases—but they show
                why “I’ll log it someday” costs time and stress when your
                packet is due. Always verify categories against your board’s
                current regulations.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-amber-500/25 bg-card/80 shadow-md shadow-black/15">
                <CardHeader>
                  <div className="text-amber-200/90 mb-2 flex size-10 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/25">
                    <FileSpreadsheet className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base">
                    One spreadsheet column for “everything clinical”
                  </CardTitle>
                  <CardDescription>
                    Face-to-face supervision, direct clinical service, and
                    non-clinical hours follow different rules by board. When
                    they’re flattened into a single total, you often end up
                    re-splitting hundreds of hours from memory—or supervisor
                    sign-offs—right before you file.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-amber-500/25 bg-card/80 shadow-md shadow-black/15">
                <CardHeader>
                  <div className="text-amber-200/90 mb-2 flex size-10 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/25">
                    <BarChart3 className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base">
                    Ignoring weekly credit limits until the end
                  </CardTitle>
                  <CardDescription>
                    Boards often cap how much experience can count per week.
                    Raw overtime notes don’t show where the cap already
                    bit—so people discover late that some time won’t count the
                    way they assumed.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-amber-500/25 bg-card/80 shadow-md shadow-black/15">
                <CardHeader>
                  <div className="text-amber-200/90 mb-2 flex size-10 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/25">
                    <Users className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base">
                    Supervision ratios checked only at packet time
                  </CardTitle>
                  <CardDescription>
                    Supervision ratios are evaluated over defined periods. If
                    you only eyeball totals once a year, it’s easy to drift
                    off-pattern—and painful to fix retroactively.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-amber-500/25 bg-card/80 shadow-md shadow-black/15">
                <CardHeader>
                  <div className="text-amber-200/90 mb-2 flex size-10 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/25">
                    <CalendarClock className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base">
                    Guessing the six-year registration window
                  </CardTitle>
                  <CardDescription>
                    Registration and experience clocks are unforgiving. Relying
                    on an old welcome email instead of tracking anniversaries in
                    your workflow means you can mis-plan how long you truly have
                    to finish hours.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="text-primary mb-3 text-sm font-semibold tracking-[0.18em] uppercase">
              Who it helps
            </p>
            <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-4xl">
              Use cases beyond “I like spreadsheets”
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-base">
              License FYI is for anyone who wants board-shaped structure from the
              start—not a prettified timesheet you’ll outgrow.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60 bg-card/80 shadow-lg shadow-black/20">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
                  <UserRound className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Trainees &amp; associates</CardTitle>
                <CardDescription>
                  Learn the category buckets your board will care about before
                  you have years of miscategorized notes in a Notes app.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-lg shadow-black/20">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-xl bg-chart-2/15 ring-1 ring-chart-2/25">
                  <Briefcase className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Multiple jobs or sites</CardTitle>
                <CardDescription>
                  Roll up hours in one place when each employer’s payroll system
                  uses different labels and none of them speak “board category.”
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-lg shadow-black/20">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-xl bg-muted ring-1 ring-border">
                  <Users className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Supervision check-ins</CardTitle>
                <CardDescription>
                  Walk into individual supervision with a clear week view—ratio
                  and category splits—instead of narrating from a static PDF you
                  exported six months ago.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-lg shadow-black/20">
              <CardHeader>
                <div className="text-primary mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
                  <AlertTriangle className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">Pre-packet crunch mode</CardTitle>
                <CardDescription>
                  When filing season hits, you want defensible history—not a
                  rescue project built from texts, shift screenshots, and sticky
                  notes. Structured logging now reduces panic later.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="border-border/50 bg-muted/25 border-y">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex gap-3">
              <Lock className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <h3 className="font-heading text-lg font-semibold tracking-tight">
                  Built with security in mind
                </h3>
                <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
                  Your account is protected with industry-standard auth. Hours
                  and profile data stay scoped to you (and, when you add them,
                  to supervisors you explicitly link)—not a shared spreadsheet
                  or open drive folder.
                </p>
              </div>
            </div>
            <Link
              href={loggedIn ? "/dashboard" : "/register"}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              {loggedIn ? "Open dashboard" : "Create your workspace"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-border/60 border-t py-10">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-2 px-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} License FYI · license.fyi · Experience
            tracking only
          </p>
          <p>
            Not legal advice; verify categories against your licensing board’s
            current rules. AI readings can be wrong—always review before saving.
          </p>
        </div>
      </footer>
    </div>
  );
}
