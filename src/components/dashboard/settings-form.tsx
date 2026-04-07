"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateSuperviseeSettings } from "@/lib/actions/settings";
import {
  LICENSE_TRACK_OPTIONS,
  type LicenseTrackId,
} from "@/lib/licensing/license-tracks";
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

const selectClass =
  "border-input bg-background ring-offset-background focus-visible:ring-ring flex min-h-11 w-full rounded-md border px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function SettingsForm({
  fullName,
  licenseTrack,
  bbsRegistrationAt,
  email,
}: {
  fullName: string;
  licenseTrack: LicenseTrackId;
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
          <CardTitle className="text-lg">Credential &amp; board</CardTitle>
          <CardDescription>
            Used by the AI documentation reader when you scan a photo or upload
            a PDF hour log—we match prompts to the worksheets your state board
            typically uses. Always review extracted hours before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet className="rounded-xl border p-4">
              <Field orientation="vertical">
                <FieldLabel htmlFor="license_track">
                  Your license path (state + credential)
                </FieldLabel>
                <FieldDescription>
                  California BBS (ASW, LMFT, LPCC), New York (LMHC, LCSW), or
                  Texas LPC—not legal advice; verify categories against current
                  regulations.
                </FieldDescription>
                <select
                  id="license_track"
                  name="license_track"
                  className={selectClass}
                  defaultValue={licenseTrack}
                  required
                >
                  {LICENSE_TRACK_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
