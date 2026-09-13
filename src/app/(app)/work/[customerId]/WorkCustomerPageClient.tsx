"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { CustomerFavicon } from "@/components/CustomerFavicon";
import { SetWorkTrail } from "@/components/WorkTrailContext";
import { workBoardHref } from "@/lib/routes";
import type { WorkSelectorCustomer } from "@/lib/workTypes";
import { WorkCreateBoardDialog } from "../WorkCreateBoardDialog";

export function WorkCustomerPageClient({
  customer,
}: {
  customer: WorkSelectorCustomer;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="w-full">
      <SetWorkTrail customerName={customer.name} />
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <CustomerFavicon
            name={customer.name}
            url={customer.url}
            color={customer.color}
          />
          <h1 className="text-heading-xl text-text-primary">{customer.name}</h1>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New board
        </Button>
      </header>

      {customer.boards.length > 0 ? (
        <ul className="grid grid-cols-1 items-start justify-items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {customer.boards.map((board) => (
            <li key={board.id}>
              <Link
                href={workBoardHref(customer.id, board.id)}
                className="block h-full rounded-xl border border-border-subtle bg-bg-default p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus focus-visible:ring-offset-2"
              >
                <span className="block truncate text-heading-s text-text-primary">
                  {board.title}
                </span>
                <span className="mt-1 block text-label-s text-text-tertiary">
                  {board.prefix}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <WorkCreateBoardDialog
        customer={customer}
        open={creating}
        onOpenChange={setCreating}
      />
    </div>
  );
}
