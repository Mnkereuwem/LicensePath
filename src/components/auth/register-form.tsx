"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Card className="border-border/80 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight">
          Create your account
        </CardTitle>
        <CardDescription>
          We provision a secure profile, default org, and ASW registration clock
          for you on first sign up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const email = String(fd.get("email") ?? "");
            const password = String(fd.get("password") ?? "");
            const fullName = String(fd.get("full_name") ?? "").trim();
            const reg = String(fd.get("bbs_registration_at") ?? "");
            setPending(true);
            try {
              const supabase = createBrowserSupabaseClient();
              const origin = window.location.origin;
              const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
                  data: {
                    full_name: fullName,
                    ...(reg ? { bbs_registration_at: reg } : {}),
                  },
                },
              });
              if (error) {
                toast.error(error.message);
                setPending(false);
                return;
              }
              toast.success("Check your email", {
                description:
                  "If email confirmation is enabled in Supabase, use the link we sent you to finish signing in.",
              });
              router.push("/login");
            } catch {
              toast.error("Missing Supabase configuration in this build.");
              setPending(false);
            }
          }}
        >
          <FieldGroup>
            <FieldSet className="rounded-xl border p-4">
              <Field orientation="vertical">
                <FieldLabel htmlFor="full_name">Full name</FieldLabel>
                <Input
                  id="full_name"
                  name="full_name"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                />
              </Field>
              <Field orientation="vertical">
                <FieldLabel htmlFor="bbs_registration_at">
                  Approx. BBS ASW registration date
                </FieldLabel>
                <FieldDescription>
                  You can refine this later in Settings.
                </FieldDescription>
                <Input
                  id="bbs_registration_at"
                  name="bbs_registration_at"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </Field>
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
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>
            </FieldSet>
          </FieldGroup>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Already registered?{" "}
            <Link href="/login" className="text-primary font-medium underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
