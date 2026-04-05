"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const err = params.get("error");

  const [pending, setPending] = useState(false);

  return (
    <Card className="border-border/80 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight">
          Welcome back
        </CardTitle>
        <CardDescription>
          Sign in to log hours and track BBS progress securely.
        </CardDescription>
        {err === "config" ? (
          <p className="text-destructive text-sm">
            Supabase environment variables are missing. Add{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="text-xs">.env.local</code>.
          </p>
        ) : err === "auth" ? (
          <p className="text-destructive text-sm">
            That sign-in link was invalid or expired. Try again.
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const email = String(fd.get("email") ?? "");
            const password = String(fd.get("password") ?? "");
            setPending(true);
            try {
              const supabase = createBrowserSupabaseClient();
              const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (error) {
                toast.error(error.message);
                setPending(false);
                return;
              }
              toast.success("Signed in");
              router.push(next);
              router.refresh();
            } catch {
              toast.error("Missing Supabase configuration in this build.");
              setPending(false);
            }
          }}
        >
          <FieldGroup>
            <FieldSet className="rounded-xl border p-4">
              <Field orientation="vertical">
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <FieldDescription>
                  <Link
                    href="https://supabase.com/dashboard"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Reset via your Supabase project
                  </Link>{" "}
                  if you host auth there without a custom reset page yet.
                </FieldDescription>
              </Field>
            </FieldSet>
          </FieldGroup>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            No account?{" "}
            <Link href="/register" className="text-primary font-medium underline">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
