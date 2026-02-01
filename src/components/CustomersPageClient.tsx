"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CustomersPageHeader } from "./CustomersPageHeader";
import { CustomerCard } from "./CustomerCard";
import { EmptyState } from "@/components/ui";
import { AddCustomerModal } from "./AddCustomerModal";
import type { CustomerWithDetails } from "@/types";

type Props = {
  customers: CustomerWithDetails[];
  error: string | null;
};

export function CustomersPageClient({ customers, error }: Props) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.contactName?.toLowerCase().includes(q)) ||
          (c.contactEmail?.toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search]);

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <CustomersPageHeader
        count={customers.length}
        onAdd={() => setAddModalOpen(true)}
      />

      <AddCustomerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {error && (
        <p className="mt-6 text-sm text-danger">Error: {error}</p>
      )}

      {!error && customers.length > 0 && (
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-primary opacity-50" />
            <input
              type="search"
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal sm:max-w-xs"
            />
          </div>
        </div>
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
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-text-primary opacity-70">
              No customers match &quot;{search}&quot;
            </p>
          ) : (
            filteredCustomers.map((customer) => (
            <CustomerCard key={customer.id} customer={customer} />
            ))
          )}
        </div>
      )}
    </>
  );
}
