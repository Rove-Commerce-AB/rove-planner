"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { revalidateProjects } from "@/app/(app)/projects/actions";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { ProjectsPageHeader } from "./ProjectsPageHeader";
import { EmptyState, Panel } from "@/components/ui";
import { AddProjectModal } from "./AddProjectModal";
import type { ProjectWithDetails } from "@/types";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";

type SortKey = "name" | "customer" | "status" | "dates" | "consultants" | "hours";
type SortDir = "asc" | "desc";

const tableBorder = "border-panel";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Props = {
  projects: ProjectWithDetails[];
  error: string | null;
};

export function ProjectsPageClient({ projects, error }: Props) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-50" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
    );
  };

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q)
      );
    }
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "customer":
          cmp = a.customerName.localeCompare(b.customerName);
          break;
        case "status":
          cmp = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
          break;
        case "dates":
          cmp =
            new Date(a.startDate ?? 0).getTime() -
            new Date(b.startDate ?? 0).getTime();
          break;
        case "consultants":
          cmp = a.consultantCount - b.consultantCount;
          break;
        case "hours":
          cmp = a.totalHoursAllocated - b.totalHoursAllocated;
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [projects, search, sortKey, sortDir]);

  const handleSuccess = async () => {
    await revalidateProjects();
    router.refresh();
  };

  return (
    <>
      <ProjectsPageHeader
        count={projects.length}
        onAdd={() => setAddModalOpen(true)}
      />

      <AddProjectModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {error && (
        <p className="mt-6 text-sm text-danger">Error: {error}</p>
      )}


      {!error && projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start allocating consultants and tracking hours."
          actionLabel="Create project"
          onAction={() => setAddModalOpen(true)}
        />
      )}

      {!error && projects.length > 0 && (
        <>
          <div
            className="mt-6 rounded-panel border border-border p-4"
            style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--panel-border)" }}
          >
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-primary opacity-50" />
              <input
                type="search"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div
              className="mt-6 rounded-panel border p-12 text-center text-sm text-text-primary opacity-70"
              style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--panel-border)" }}
            >
              No projects match &quot;{search}&quot;
            </div>
          ) : (
            <Panel className="mt-6">
              <h2
                className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-base font-semibold text-text-primary`}
              >
                Projects
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className={`border-b ${tableBorder} bg-bg-muted/80`}>
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("name")}
                          className="flex items-center font-medium text-text-primary hover:opacity-80"
                        >
                          Project
                          <SortIcon column="name" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("customer")}
                          className="flex items-center font-medium text-text-primary hover:opacity-80"
                        >
                          Customer
                          <SortIcon column="customer" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("status")}
                          className="flex items-center font-medium text-text-primary hover:opacity-80"
                        >
                          Status
                          <SortIcon column="status" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("dates")}
                          className="flex items-center font-medium text-text-primary hover:opacity-80"
                        >
                          Dates
                          <SortIcon column="dates" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("consultants")}
                          className="flex items-center font-medium text-text-primary hover:opacity-80"
                        >
                          Consultants
                          <SortIcon column="consultants" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => toggleSort("hours")}
                          className="flex items-center font-medium text-text-primary hover:opacity-80"
                        >
                          Allocated
                          <SortIcon column="hours" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project) => {
                      const color = project.color || DEFAULT_CUSTOMER_COLOR;
                      const isInactive = !project.isActive;
                      const dateRange =
                        project.startDate || project.endDate
                          ? `${formatDate(project.startDate)} – ${formatDate(project.endDate)}`
                          : "—";
                      return (
                        <tr
                          key={project.id}
                          className={`cursor-pointer transition-colors hover:bg-bg-muted/50 ${isInactive ? "opacity-70" : ""}`}
                          onClick={() => router.push(`/projects/${project.id}`)}
                        >
                          <td className={`border-b ${tableBorder} px-4 py-3`}>
                            <div className="flex items-center gap-3">
                              <div
                                className="h-9 w-1 flex-shrink-0 rounded"
                                style={{ backgroundColor: color }}
                                aria-hidden
                              />
                              <div>
                                <span className="font-medium text-text-primary">
                                  {project.name}
                                </span>
                                {isInactive && (
                                  <span className="ml-2 rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-text-primary opacity-80">
                                    Inactive
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`border-b ${tableBorder} px-4 py-3 text-text-primary opacity-90`}>
                            {project.customerName}
                          </td>
                          <td className={`border-b ${tableBorder} px-4 py-3 text-text-primary opacity-90`}>
                            {project.isActive ? (
                              <span className="rounded-full bg-brand-blue/60 px-2 py-0.5 text-xs font-medium text-text-primary">
                                Active
                              </span>
                            ) : (
                              <span className="text-text-primary opacity-70">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className={`border-b ${tableBorder} px-4 py-3 text-text-primary opacity-90`}>
                            {dateRange}
                          </td>
                          <td className={`border-b ${tableBorder} px-4 py-3 text-text-primary opacity-90`}>
                            {project.consultantCount} consultant
                            {project.consultantCount !== 1 ? "s" : ""}
                          </td>
                          <td className={`border-b ${tableBorder} px-4 py-3 font-medium tabular-nums text-text-primary opacity-90`}>
                            {project.totalHoursAllocated}h
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
