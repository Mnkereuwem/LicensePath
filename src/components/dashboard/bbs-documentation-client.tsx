"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteBbsDocumentationByStoragePath } from "@/lib/actions/bbs-documentation";
import type { BbsDocumentationListItem } from "@/lib/data/dashboard-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatImportedAt(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BbsDocumentationClient({
  initialItems,
}: {
  initialItems: BbsDocumentationListItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const onDelete = useCallback(
    (item: BbsDocumentationListItem) => {
      const ok = window.confirm(
        `Remove “${item.displayName}” and subtract its ${item.lineCount} imported line(s) from your weekly totals and dashboard progress? This cannot be undone.`,
      );
      if (!ok) return;

      setDeletingPath(item.storagePath);
      startTransition(async () => {
        const res = await deleteBbsDocumentationByStoragePath(item.storagePath);
        setDeletingPath(null);
        if (res.ok) {
          toast.success("Documentation removed", {
            description: `Subtracted ${res.removedLines} line(s) from your weekly grid. Open Dashboard to see the updated progress bar.`,
          });
          refresh();
        } else {
          toast.error("Could not remove", { description: res.message });
        }
      });
    },
    [refresh],
  );

  if (initialItems.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        No PDF or photo imports saved yet. Use{" "}
        <span className="text-foreground font-medium">Log hours</span> (PDF) or{" "}
        <span className="text-foreground font-medium">Scan log</span> (photo) to
        add documentation; it will show here and feed your progress bar.
      </p>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-muted/50 border-border border-b">
            <th className="px-3 py-2.5 font-medium">Document</th>
            <th className="hidden px-2 py-2.5 font-medium sm:table-cell">Type</th>
            <th className="px-2 py-2.5 font-medium tabular-nums">Lines</th>
            <th className="hidden px-2 py-2.5 font-medium md:table-cell">
              Imported
            </th>
            <th className="px-2 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {initialItems.map((item) => (
            <tr
              key={item.storagePath}
              className="border-border/60 border-b last:border-b-0"
            >
              <td
                className={cn(
                  "text-foreground max-w-[min(100%,14rem)] px-3 py-2 font-medium break-all sm:max-w-xs",
                )}
              >
                {item.displayName}
              </td>
              <td className="text-muted-foreground hidden px-2 py-2 sm:table-cell">
                {item.sourceKind === "pdf" ? "PDF" : "Photo scan"}
              </td>
              <td className="px-2 py-2 tabular-nums">{item.lineCount}</td>
              <td className="text-muted-foreground hidden px-2 py-2 text-sm md:table-cell">
                {formatImportedAt(item.firstImportedAt)}
              </td>
              <td className="px-2 py-2">
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                >
                  Active
                </Badge>
                <span className="text-muted-foreground sr-only sm:not-sr-only sm:ml-1 sm:text-xs">
                  → progress
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 gap-1"
                  disabled={pending}
                  onClick={() => onDelete(item)}
                >
                  {deletingPath === item.storagePath ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden />
                  )}
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground border-border border-t px-3 py-2 text-xs leading-relaxed">
        <span className="text-foreground font-medium">Active</span> means this
        file’s imported lines are in your audit log. The dashboard progress bar
        uses credited hours (after weekly caps), so the percent may not equal a
        raw sum of every row. Deleting subtracts this import’s hours from the
        weekly grid; refresh Dashboard to see the bar update.
      </p>
    </div>
  );
}
