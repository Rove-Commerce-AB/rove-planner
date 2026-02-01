import { getProjectsWithDetails } from "@/lib/projects";
import { ProjectsPageClient } from "@/components/ProjectsPageClient";

export default async function ProjectsPage() {
  let projects: Awaited<ReturnType<typeof getProjectsWithDetails>> = [];
  let error: string | null = null;

  try {
    projects = await getProjectsWithDetails();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch projects";
  }

  return (
    <div className="p-6">
      <ProjectsPageClient projects={projects} error={error} />
    </div>
  );
}
