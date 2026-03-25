"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { IconButton, Panel, PanelSectionTitle } from "@/components/ui";
import type { CustomerWithDetails } from "@/types";

export function CustomerDetailProjectsPanel({
  projects,
  showInactiveProjects,
  setShowInactiveProjects,
  onAddProject,
}: {
  projects: CustomerWithDetails["projects"];
  showInactiveProjects: boolean;
  setShowInactiveProjects: Dispatch<SetStateAction<boolean>>;
  onAddProject: () => void;
}) {
  const router = useRouter();

  return (
    <Panel>
      <PanelSectionTitle
        action={
          <IconButton
            aria-label="Add project"
            onClick={onAddProject}
            className="text-text-muted hover:text-text-primary"
          >
            <Plus className="h-4 w-4" />
          </IconButton>
        }
      >
        PROJECTS
      </PanelSectionTitle>
      <div className="overflow-x-auto p-3 pt-0">
        {projects.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-primary opacity-60">
            No projects for this customer.
          </p>
        ) : (
          <>
            <ul className="space-y-0.5">
              {[
                ...(showInactiveProjects
                  ? projects
                  : projects.filter((p) => p.isActive)),
              ]
                .sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1))
                .map((p) => (
                  <li
                    key={p.id}
                    className={`flex h-[2.25rem] cursor-pointer items-center gap-4 rounded-md px-2 transition-colors hover:bg-bg-muted/50 ${!p.isActive ? "opacity-60" : ""}`}
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                      {p.name}
                    </span>
                  </li>
                ))}
            </ul>
            {!showInactiveProjects && projects.some((p) => !p.isActive) && (
              <button
                type="button"
                onClick={() => setShowInactiveProjects(true)}
                className="mt-2 w-full rounded-md py-2 text-center text-sm font-medium text-text-primary opacity-70 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
                aria-label="Show inactive projects"
              >
                Show inactive ({projects.filter((p) => !p.isActive).length})
              </button>
            )}
            {showInactiveProjects && projects.some((p) => !p.isActive) && (
              <button
                type="button"
                onClick={() => setShowInactiveProjects(false)}
                className="mt-2 w-full rounded-md py-2 text-center text-sm font-medium text-text-primary opacity-70 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
                aria-label="Hide inactive projects"
              >
                Hide inactive
              </button>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
