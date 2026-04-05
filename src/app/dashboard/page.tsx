import { StatsGrid } from "@/components/dashboard/stats-grid";
import { fetchDashboardModel } from "@/lib/data/dashboard-data";

export default async function DashboardPage() {
  const model = await fetchDashboardModel();

  if (!model) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          Live totals from your logged weeks, supervision ratio for the current
          week (Monday start), and your six-year ASW registration clock.
        </p>
      </div>
      <StatsGrid model={model} />
    </div>
  );
}
