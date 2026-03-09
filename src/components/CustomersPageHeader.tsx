"use client";

import { PageHeader } from "@/components/ui";

type Props = {
  count: number;
};

export function CustomersPageHeader({ count }: Props) {
  return (
    <PageHeader
      title="Customers"
      description={`${count} customer${count !== 1 ? "s" : ""}`}
    />
  );
}
