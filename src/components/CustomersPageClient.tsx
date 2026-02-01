"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { CustomersPageHeader } from "./CustomersPageHeader";
import { EmptyState } from "@/components/ui";
import { AddCustomerModal } from "./AddCustomerModal";
import type { CustomerWithDetails } from "@/types";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";

type SortKey = "name" | "contact" | "projects" | "email";
type SortDir = "asc" | "desc";

type Props = {
  customers: CustomerWithDetails[];
  error: string | null;
};

export function CustomersPageClient({ customers, error }: Props) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-50" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
    );
  };

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
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "contact":
          cmp = (a.contactName ?? "").localeCompare(b.contactName ?? "");
          break;
        case "projects":
          cmp = a.activeProjectCount - b.activeProjectCount;
          break;
        case "email":
          cmp = (a.contactEmail ?? "").localeCompare(b.contactEmail ?? "");
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [customers, search, sortKey, sortDir]);

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
        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-bg-default">
          {filteredCustomers.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-primary opacity-70">
              No customers match &quot;{search}&quot;
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-muted/80">
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className="flex items-center font-medium text-text-primary hover:opacity-80"
                      >
                        Name
                        <SortIcon column="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("contact")}
                        className="flex items-center font-medium text-text-primary hover:opacity-80"
                      >
                        Contact
                        <SortIcon column="contact" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("projects")}
                        className="flex items-center font-medium text-text-primary hover:opacity-80"
                      >
                        Active projects
                        <SortIcon column="projects" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("email")}
                        className="flex items-center font-medium text-text-primary hover:opacity-80"
                      >
                        Contact email
                        <SortIcon column="email" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => {
                    const color = customer.color || DEFAULT_CUSTOMER_COLOR;
                    return (
                      <tr
                        key={customer.id}
                        className="cursor-pointer transition-colors hover:bg-bg-muted/50"
                        onClick={() => router.push(`/customers/${customer.id}`)}
                      >
                        <td className="border-b border-border px-4 py-3">
                          <div className="flex items-center gap-3">
                            {customer.logoUrl ? (
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-muted">
                                <img
                                  src={customer.logoUrl}
                                  alt=""
                                  className="h-full w-full object-contain p-0.5"
                                />
                              </div>
                            ) : (
                              <div
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-medium text-text-inverse"
                                style={{ backgroundColor: color }}
                              >
                                {customer.initials}
                              </div>
                            )}
                            <span className="font-medium text-text-primary">{customer.name}</span>
                          </div>
                        </td>
                        <td className="border-b border-border px-4 py-3 text-text-primary opacity-90">
                          {customer.contactName ?? "—"}
                        </td>
                        <td className="border-b border-border px-4 py-3 text-text-primary opacity-90">
                          {customer.activeProjectCount} project
                          {customer.activeProjectCount !== 1 ? "s" : ""}
                        </td>
                        <td className="border-b border-border px-4 py-3">
                          {customer.contactEmail ? (
                            <a
                              href={`mailto:${customer.contactEmail}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-brand-signal hover:underline"
                            >
                              {customer.contactEmail}
                            </a>
                          ) : (
                            <span className="text-text-primary opacity-50">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
