"use client";

import { PageHeader } from "@/components/ui";

type Props = {
  count: number;
};

export function ConsultantsPageHeader({ count }: Props) {
  return (
    <PageHeader
      title="Consultants"
      description={`${count} consultant${count !== 1 ? "s" : ""}`}
    />
  );
}
