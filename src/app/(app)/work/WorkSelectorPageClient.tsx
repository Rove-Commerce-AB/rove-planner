"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { CustomerFavicon } from "@/components/CustomerFavicon";
import { workBoardHref, workCustomerHref } from "@/lib/routes";
import type { WorkSelectorCustomer } from "@/lib/workTypes";
import { WorkCreateBoardDialog } from "./WorkCreateBoardDialog";

type Props = {
  customers: WorkSelectorCustomer[];
};

export function WorkSelectorPageClient({ customers }: Props) {
  const [createForCustomerId, setCreateForCustomerId] = useState<string | null>(
    null
  );

  const createCustomer = customers.find(
    (customer) => customer.id === createForCustomerId
  );

  return (
    <div className="w-full">
      <PageHeader
        title="Select customer"
        description="Open a board to start working, or create one for a customer that has none yet."
        className="mb-6"
      />

      {customers.length === 0 ? (
        <p className="rounded-xl border border-border-subtle bg-bg-default px-4 py-10 text-center text-sm text-text-secondary">
          No customers assigned yet. Ask an admin to link you to a customer.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start justify-items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {customers.map((customer) => (
            <article
              key={customer.id}
              className="rounded-xl border border-border-subtle bg-bg-default p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Link
                  href={workCustomerHref(customer.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-text-primary transition-colors hover:text-accent-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus focus-visible:ring-offset-2"
                >
                  <CustomerFavicon
                    name={customer.name}
                    url={customer.url}
                    color={customer.color}
                  />
                  <h2 className="min-w-0 flex-1 truncate text-heading-s">
                    {customer.name}
                  </h2>
                </Link>
                <button
                  type="button"
                  onClick={() => setCreateForCustomerId(customer.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-muted hover:text-text-primary"
                  aria-label={`Create board for ${customer.name}`}
                  title="Create board"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {customer.boards.length > 0 ? (
                <ul className="mt-3 divide-y divide-border-subtle">
                  {customer.boards.map((board) => (
                    <li key={board.id}>
                      <Link
                        href={workBoardHref(customer.id, board.id)}
                        className="flex items-center justify-between gap-3 py-2.5 text-body-m text-text-primary transition-colors hover:text-accent-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus focus-visible:ring-offset-2"
                      >
                        <span className="min-w-0 truncate">{board.title}</span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-text-tertiary"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <WorkCreateBoardDialog
        customer={createCustomer ?? null}
        open={createForCustomerId != null}
        onOpenChange={(open) => {
          if (!open) setCreateForCustomerId(null);
        }}
      />
    </div>
  );
}
