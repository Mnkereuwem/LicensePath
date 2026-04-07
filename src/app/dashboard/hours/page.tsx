import { HoursEditor } from "@/components/dashboard/hours-editor";
import { startOfWeekMonday } from "@/lib/dates/week";
import { fetchHoursPageContext } from "@/lib/data/dashboard-data";

/** OCR + PDF parsing can exceed the default function limit on Vercel. */
export const maxDuration = 60;

export default async function LogHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const week =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
      ? sp.week
      : startOfWeekMonday();

  const ctx = await fetchHoursPageContext(week);

  return (
    <HoursEditor
      weekStart={week}
      initial={ctx.values}
      weeklyCreditCap={ctx.weeklyCreditCap}
      licenseTrackLabel={ctx.licenseTrackLabel}
      rulesBlurb={ctx.rulesBlurb}
    />
  );
}
