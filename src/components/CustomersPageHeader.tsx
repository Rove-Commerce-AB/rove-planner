"use client";

import { Plus } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";

type Props = {
  count: number;
  onAdd: () => void;
};

export function CustomersPageHeader({ count, onAdd }: Props) {
  return (
    <PageHeader
      title="Customers"
      description={`${count} customer${count !== 1 ? "s" : ""}`}
    >
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add customer
      </Button>
    </PageHeader>
  );
}
