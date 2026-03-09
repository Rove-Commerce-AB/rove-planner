"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CustomersPageHeader } from "./CustomersPageHeader";
import { EmptyState, IconButton, Panel, PanelSectionTitle } from "@/components/ui";
import { AddCustomerModal } from "./AddCustomerModal";
import type { CustomerWithDetails } from "@/types";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";

type Props = {
  customers: CustomerWithDetails[];
  error: string | null;
};

export function CustomersPageClient({ customers, error }: Props) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const visibleCustomers = useMemo(
    () => (showInactive ? customers : customers.filter((c) => c.isActive)),
    [customers, showInactive]
  );

  const sortedCustomers = useMemo(
    () =>
      [...visibleCustomers].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [visibleCustomers]
  );

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <CustomersPageHeader count={customers.length} />

      <AddCustomerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {error && (
        <p className="mt-6 text-sm text-danger" role="alert">
          Error: {error}
        </p>
      )}

      {!error && customers.length === 0 && (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to start creating projects and managing rates."
          actionLabel="Add customer"
          onAction={() => setAddModalOpen(true)}
        />
      )}

      {!error && customers.length > 0 && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2">
          <Panel>
          <PanelSectionTitle
            action={
              <IconButton
                aria-label="Add customer"
                onClick={() => setAddModalOpen(true)}
                className="text-text-muted hover:text-text-primary"
              >
                <Plus className="h-4 w-4" />
              </IconButton>
            }
          >
            CUSTOMERS
          </PanelSectionTitle>
          <div className="overflow-x-auto p-3 pt-0">
            {visibleCustomers.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-primary opacity-60">
                No active customers.
              </p>
            ) : null}
            {visibleCustomers.length > 0 && (
              <ul className="space-y-0.5">
                {sortedCustomers.map((c) => {
                  const color = c.color || DEFAULT_CUSTOMER_COLOR;
                  return (
                    <li
                      key={c.id}
                      className={`flex h-[2.25rem] cursor-pointer items-center gap-3 rounded-md px-2 transition-colors hover:bg-bg-muted/50 ${!c.isActive ? "opacity-60" : ""}`}
                      onClick={() => router.push(`/customers/${c.id}`)}
                    >
                      {c.logoUrl ? (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-muted">
                          <img
                            src={c.logoUrl}
                            alt=""
                            className="h-full w-full object-contain p-0.5"
                          />
                        </div>
                      ) : (
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-medium text-text-inverse"
                          style={{ backgroundColor: color }}
                        >
                          {c.initials}
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                        {c.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {!showInactive && customers.some((c) => !c.isActive) && (
              <button
                type="button"
                onClick={() => setShowInactive(true)}
                className="mt-2 w-full rounded-md py-2 text-center text-sm font-medium text-text-primary opacity-70 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
                aria-label="Show inactive customers"
              >
                Show inactive ({customers.filter((c) => !c.isActive).length})
              </button>
            )}
            {showInactive && customers.some((c) => !c.isActive) && (
              <button
                type="button"
                onClick={() => setShowInactive(false)}
                className="mt-2 w-full rounded-md py-2 text-center text-sm font-medium text-text-primary opacity-70 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
                aria-label="Hide inactive customers"
              >
                Hide inactive
              </button>
            )}
          </div>
        </Panel>
        </div>
      )}
    </>
  );
}
