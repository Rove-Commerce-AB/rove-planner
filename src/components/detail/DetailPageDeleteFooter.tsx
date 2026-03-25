"use client";

import { Button } from "@/components/ui";

/** Shared destructive footer for customer / consultant / project detail pages. */
export function DetailPageDeleteFooter({
  onRequestDelete,
  disabled,
  label = "Delete",
  className = "pt-4",
}: {
  onRequestDelete: () => void;
  disabled: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Button
        variant="ghost"
        className="text-danger hover:bg-danger/10 hover:text-danger"
        onClick={onRequestDelete}
        disabled={disabled}
      >
        {label}
      </Button>
    </div>
  );
}
