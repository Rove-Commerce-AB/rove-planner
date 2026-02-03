import { notFound } from "next/navigation";
import { getProjectWithDetailsById } from "@/lib/projects";
import { ProjectDetailClient } from "@/components/ProjectDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await getProjectWithDetailsById(id);

  if (!project) notFound();

  return (
    <div className="p-6">
      <ProjectDetailClient project={project} />
    </div>
  );
}
