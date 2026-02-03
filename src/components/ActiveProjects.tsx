import Link from "next/link";
import { FolderKanban } from "lucide-react";
import type { Project } from "@/types";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";
import { Panel } from "@/components/ui";

type Props = {
  projects: Project[];
};

const panelHeaderBorder = "border-panel";

function formatDate(dateStr: string) {
  if (!dateStr) return "–";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ActiveProjects({ projects }: Props) {
  return (
    <Panel>
      <div
        className={`flex items-center gap-2 border-b ${panelHeaderBorder} bg-bg-muted/40 px-4 py-3`}
      >
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
          <FolderKanban className="h-4 w-4" />
          Active projects
        </h2>
      </div>
      <div className="space-y-3 p-5">
        {projects.length === 0 ? (
          <p className="text-sm text-text-primary opacity-70">
            No active projects.
          </p>
        ) : (
          projects.map((p) => (
            <Link
              key={p.id}
              href="/allocation"
              className="block rounded-lg border border-panel bg-bg-default p-3 transition-colors hover:border-brand-lilac/50"
            >
              <div className="flex items-start gap-2">
                <div
                  className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: p.color || DEFAULT_CUSTOMER_COLOR }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">{p.name}</p>
                  <p className="text-sm text-text-primary opacity-70">
                    {p.customerName}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-primary opacity-60">
                    <span>{p.consultantCount} consultants</span>
                    <span>Total: {p.totalHours}h allocated</span>
                  </div>
                  <p className="mt-1 text-xs text-text-primary opacity-60">
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Panel>
  );
}
