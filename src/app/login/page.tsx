import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="from-background via-background relative min-h-screen bg-gradient-to-br to-teal-50/50 dark:to-teal-950/25">
      <header className="border-border/60 bg-background/70 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-foreground flex items-center gap-2 text-sm font-semibold"
          >
            <span className="bg-primary text-primary-foreground inline-flex size-8 items-center justify-center rounded-lg">
              <ClipboardList className="size-4" aria-hidden />
            </span>
            LicensePath
          </Link>
          <Link
            href="/register"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Create account
          </Link>
        </div>
      </header>
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col justify-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-16">
        <div className="max-w-md flex-1 space-y-4">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">
            Secure ASW workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Hours that hold up in supervision and at the board.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Track direct clinical work, supervision ratios, weekly caps, and
            your six-year registration clock with Supabase-backed auth and RLS.
          </p>
        </div>
        <div className="w-full max-w-md flex-1">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
