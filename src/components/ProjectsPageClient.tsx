"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { revalidateProjects } from "@/app/projects/actions";
import { Search } from "lucide-react";
import { ProjectsPageHeader } from "./ProjectsPageHeader";
import { ProjectCard } from "./ProjectCard";
import { EmptyState } from "@/components/ui";
import { AddProjectModal } from "./AddProjectModal";
import type { ProjectWithDetails } from "@/types";

type Props = {
  projects: ProjectWithDetails[];
  error: string | null;
};

export function ProjectsPageClient({ projects, error }: Props) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.trim().toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q)
    );
  }, [projects, search]);

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

      {!error && projects.length > 0 && (
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-primary opacity-50" />
            <input
              type="search"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal sm:max-w-xs"
            />
          </div>
        </div>
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
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-text-primary opacity-70">
              No projects match &quot;{search}&quot;
            </p>
          ) : (
            filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
            ))
          )}
        </div>
      )}
    </>
  );
}
