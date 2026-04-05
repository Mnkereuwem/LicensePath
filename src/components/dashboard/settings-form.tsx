"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateSuperviseeSettings } from "@/lib/actions/settings";
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

export function SettingsForm({
  fullName,
  bbsRegistrationAt,
  email,
}: {
  fullName: string;
  bbsRegistrationAt: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mx-auto w-full max-w-lg space-y-6"
      action={(fd) => {
        startTransition(async () => {
          const res = await updateSuperviseeSettings(fd);
          if (res.ok) {
            toast.success("Settings saved");
            router.refresh();
          } else {
            toast.error(res.message);
          }
        });
      }}
    >
      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>
            Signed in as <span className="text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet className="rounded-xl border p-4">
              <Field orientation="vertical">
                <FieldLabel htmlFor="full_name">Display name</FieldLabel>
                <FieldDescription>
                  Used in exports and supervisor views later on.
                </FieldDescription>
                <Input
                  id="full_name"
                  name="full_name"
                  defaultValue={fullName}
                  autoComplete="name"
                  placeholder="Alex Morgan"
                />
              </Field>
            </FieldSet>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">BBS registration</CardTitle>
          <CardDescription>
            ASW registration date starts your six-year sunset clock on the
            dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet className="rounded-xl border p-4">
              <Field orientation="vertical">
                <FieldLabel htmlFor="bbs_registration_at">
                  Registration date
                </FieldLabel>
                <FieldDescription>
                  Stored as calendar date (YYYY-MM-DD) in Pacific time planning;
                  confirm against your BBS letter.
                </FieldDescription>
                <Input
                  id="bbs_registration_at"
                  name="bbs_registration_at"
                  type="date"
                  required
                  defaultValue={bbsRegistrationAt}
                />
              </Field>
            </FieldSet>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
