import { getProjectsWithDetails } from "@/lib/projects";
import { ProjectsPageClient } from "@/components/ProjectsPageClient";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";

export default async function ProjectsPage() {
  await redirectSubcontractorToAccessDenied();

  let projects: Awaited<ReturnType<typeof getProjectsWithDetails>> = [];
  let error: string | null = null;

  try {
    projects = await getProjectsWithDetails();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch projects";
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <ProjectsPageClient projects={projects} error={error} />
      </div>
    </div>
  );
}
