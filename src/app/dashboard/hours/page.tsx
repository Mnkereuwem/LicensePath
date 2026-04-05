import { HoursEditor } from "@/components/dashboard/hours-editor";
import { startOfWeekMonday } from "@/lib/dates/week";
import { fetchWeekHourValues } from "@/lib/data/dashboard-data";

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

  const initial = await fetchWeekHourValues(week);

  return <HoursEditor weekStart={week} initial={initial} />;
}
