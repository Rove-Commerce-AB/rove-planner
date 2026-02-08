"use client";

import Link from "next/link";
import { User, FolderKanban } from "lucide-react";
import type { CustomerWithDetails } from "@/types";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";

type Props = {
  customer: CustomerWithDetails;
};

export function CustomerCard({ customer }: Props) {
  const color = customer.color || DEFAULT_CUSTOMER_COLOR;

  return (
    <Link
      href={`/customers/${customer.id}`}
      className="block rounded-lg border border-border border-l-4 bg-bg-default p-4 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-signal focus:ring-offset-2"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {customer.logoUrl ? (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-muted">
              <img
                src={customer.logoUrl}
                alt={`${customer.name} logo`}
                className="h-full w-full object-contain p-1"
              />
            </div>
          ) : (
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg text-sm font-medium text-text-inverse"
              style={{ backgroundColor: color }}
            >
              {customer.initials}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-text-primary">{customer.name}</h3>
            <span className="inline-block rounded-full bg-brand-lilac/40 px-2 py-0.5 text-xs text-text-primary">
              {customer.activeProjectCount} active project
              {customer.activeProjectCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {(customer.accountManagerName != null && customer.accountManagerName !== "") && (
        <div className="mt-4 flex items-center gap-2 text-sm text-text-primary opacity-80">
          <User className="h-4 w-4 flex-shrink-0 opacity-60" />
          <span>Account Manager: {customer.accountManagerName}</span>
        </div>
      )}

      {customer.primaryProject && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 flex-shrink-0 opacity-60" />
              <span className="text-sm font-medium text-text-primary">
                {customer.primaryProject.name}
              </span>
            </div>
            {customer.primaryProject.isActive && (
              <span className="rounded-full bg-brand-blue/60 px-2 py-0.5 text-xs font-medium text-text-primary">
                Active
              </span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}
