import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="from-background via-background relative min-h-screen bg-gradient-to-br to-primary/[0.06]">
      <header className="border-border/50 bg-background/80 sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandMark />
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col justify-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-16">
        <div className="max-w-md flex-1 space-y-4">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">
            California ASW ready
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-tight">
            Set up your six-year clock in minutes.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Create an account, log weeks with category splits, and keep
            supervision ratios visible before you chase the 3,000-hour finish
            line.
          </p>
        </div>
        <div className="w-full max-w-md flex-1">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
