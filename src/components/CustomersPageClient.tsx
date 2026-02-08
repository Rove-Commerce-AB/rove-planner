"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { CustomersPageHeader } from "./CustomersPageHeader";
import { EmptyState, Panel } from "@/components/ui";
import { AddCustomerModal } from "./AddCustomerModal";
import type { CustomerWithDetails } from "@/types";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";

type SortKey = "name" | "accountManager" | "projects";
type SortDir = "asc" | "desc";

const tableBorder = "border-panel";

type Props = {
  customers: CustomerWithDetails[];
  error: string | null;
};

export function CustomersPageClient({ customers, error }: Props) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const visibleCustomers = useMemo(
    () => (showInactive ? customers : customers.filter((c) => c.isActive)),
    [customers, showInactive]
  );

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
    let result = visibleCustomers;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.accountManagerName?.toLowerCase().includes(q))
      );
    }
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "accountManager":
          cmp = (a.accountManagerName ?? "").localeCompare(b.accountManagerName ?? "");
          break;
        case "projects":
          cmp = a.activeProjectCount - b.activeProjectCount;
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [visibleCustomers, search, sortKey, sortDir]);

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <CustomersPageHeader
        count={visibleCustomers.length}
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


      {!error && customers.length === 0 && (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to start creating projects and managing rates."
          actionLabel="Add customer"
          onAction={() => setAddModalOpen(true)}
        />
      )}

      {!error && visibleCustomers.length === 0 && customers.length > 0 && (
        <div
          className="mt-6 rounded-panel border border-border p-6 text-center text-sm text-text-primary"
          style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--panel-border)" }}
        >
          No active customers. Enable &quot;Show inactive customers&quot; below to see inactive.
        </div>
      )}

      {!error && customers.length > 0 && (
        <>
          <div
            className="mt-6 flex flex-col gap-3 rounded-panel border border-border p-4 sm:flex-row sm:items-center sm:gap-4"
            style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--panel-border)" }}
          >
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-primary opacity-50" />
              <input
                type="search"
                placeholder="Search customers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-border text-brand-signal focus:ring-brand-signal"
              />
              Show inactive customers
            </label>
          </div>

          {visibleCustomers.length > 0 && filteredCustomers.length === 0 ? (
            <div
              className="mt-6 rounded-panel border p-12 text-center text-sm text-text-primary opacity-70"
              style={{ backgroundColor: "var(--panel-bg)", borderColor: "var(--panel-border)" }}
            >
              No customers match &quot;{search}&quot;
            </div>
          ) : visibleCustomers.length > 0 ? (
            <Panel className="mt-6">
              <h2
                className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-base font-semibold text-text-primary`}
              >
                Customers
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className={`border-b ${tableBorder} bg-bg-muted/80`}>
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
                          onClick={() => toggleSort("accountManager")}
                          className="flex items-center font-medium text-text-primary hover:opacity-80"
                        >
                          Account Manager
                          <SortIcon column="accountManager" />
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
                          <td className={`border-b ${tableBorder} px-4 py-3`}>
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
                          <td className={`border-b ${tableBorder} px-4 py-3 text-text-primary opacity-90`}>
                            {customer.accountManagerName ?? "—"}
                          </td>
                          <td className={`border-b ${tableBorder} px-4 py-3 text-text-primary opacity-90`}>
                            {customer.activeProjectCount} project
                            {customer.activeProjectCount !== 1 ? "s" : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </>
  );
}
