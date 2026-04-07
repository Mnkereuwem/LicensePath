import { StatsGrid } from "@/components/dashboard/stats-grid";
import { fetchDashboardModel } from "@/lib/data/dashboard-data";

export default async function DashboardPage() {
  const { model, warnings } = await fetchDashboardModel();

  if (!model) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-foreground font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Live totals from your logged weeks, current-week snapshot, and
          experience clock—numbers follow the license track you select in
          Settings (weekly caps, targets, and supervision rules).
        </p>
      </div>
      {warnings.length > 0 ? (
        <div
          role="alert"
          className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-100 rounded-lg border px-4 py-3 text-sm leading-relaxed"
        >
          <ul className="list-inside list-disc space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <StatsGrid model={model} />
    </div>
  );
}
