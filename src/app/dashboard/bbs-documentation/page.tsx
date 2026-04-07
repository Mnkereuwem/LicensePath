import { FolderOpen } from "lucide-react";

import { BbsDocumentationClient } from "@/components/dashboard/bbs-documentation-client";
import { fetchBbsDocumentationList } from "@/lib/data/dashboard-data";

export const metadata = {
  title: "BBS Documentation | LicensePath",
  description:
    "Manage uploaded BBS logs and scans; remove imports and update experience progress.",
};

export default async function BbsDocumentationPage() {
  const items = await fetchBbsDocumentationList();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary ring-primary/15 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <FolderOpen className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            BBS Documentation
          </h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed sm:text-base">
            Every PDF import and confirmed photo scan listed here is{" "}
            <span className="text-foreground font-medium">Active</span>: its
            lines are stored in your audit log and rolled into{" "}
            <span className="text-foreground font-medium">weekly totals</span>{" "}
            that drive the dashboard experience progress bar. Deleting a row
            removes the file from storage, deletes those log lines, and subtracts
            the same hours from your grid so totals stay in sync. New imports
            update the weekly grid before log lines are saved, so this list
            matches credited progress. If an older import never changed your
            dashboard, delete it here.
          </p>
        </div>
      </div>

      <BbsDocumentationClient initialItems={items} />
    </div>
  );
}
