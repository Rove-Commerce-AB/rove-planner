"use client";

import { Plus } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";

type Props = {
  count: number;
  onAdd: () => void;
};

export function ProjectsPageHeader({ count, onAdd }: Props) {
  return (
    <PageHeader
      title="Projects"
      description={`${count} project${count !== 1 ? "s" : ""}`}
    >
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Create project
      </Button>
    </PageHeader>
  );
}
