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
            <span className="text-foreground font-medium">1:1 rule:</span> one
            row here per import that is still reflected in your weekly hour grid.
            If the tracker has no reported hours at all, this page is empty.
            Manual-only weeks do not create rows. Three active imports → three
            deletable documents; deleting one removes that file and subtracts its
            hours. Orphan log lines that do not affect the grid stay hidden.
          </p>
        </div>
      </div>

      <BbsDocumentationClient initialItems={items} />
    </div>
  );
}
