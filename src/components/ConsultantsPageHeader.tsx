"use client";

import { Plus } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";

type Props = {
  count: number;
  onAdd: () => void;
};

export function ConsultantsPageHeader({ count, onAdd }: Props) {
  return (
    <PageHeader
      title="Consultants"
      description={`${count} consultant${count !== 1 ? "s" : ""} in team`}
    >
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add consultant
      </Button>
    </PageHeader>
  );
}
