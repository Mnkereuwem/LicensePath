/** Local calendar date YYYY-MM-DD */
export function formatLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-start week; uses local timezone. */
export function startOfWeekMonday(ref: Date = new Date()): string {
  const d = new Date(ref);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return formatLocalISODate(d);
}

/** Display label e.g. "Mar 31 – Apr 6, 2026" for Monday week_start. */
export function formatWeekRangeLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const y = end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", fmt)} – ${end.getDate()}, ${y}`;
  }
  return `${start.toLocaleDateString("en-US", fmt)} – ${end.toLocaleDateString("en-US", { ...fmt, year: "numeric" })}`;
}
