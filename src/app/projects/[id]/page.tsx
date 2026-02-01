import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectWithDetailsById } from "@/lib/projects";
import { ProjectDetailClient } from "@/components/ProjectDetailClient";
import { Button } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await getProjectWithDetailsById(id);

  if (!project) notFound();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="secondary" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Link>
        </Button>
      </div>

      <ProjectDetailClient project={project} />
    </div>
  );
}
