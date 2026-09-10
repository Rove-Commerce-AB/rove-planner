"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { AddCustomerModal } from "@/components/AddCustomerModal";
import { CustomerDrawerContent } from "@/components/CustomerDrawerContent";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  SegmentedControl,
  SideDrawer,
  type DataTableColumn,
} from "@/components/ui";
import type {
  CustomerConsultant,
  CustomerConsultantsByCustomerId,
} from "@/lib/customerConsultantsQueries";
import { ROUTES, customerHref } from "@/lib/routes";
import type { CustomerWithDetails } from "@/types";

type CustomerFilter = "all" | "active" | "inactive" | "internal";
type SortKey =
  | "name"
  | "accountManager"
  | "activeProjects"
  | "type"
  | "status";
type SortDirection = "asc" | "desc";

type Props = {
  customers: CustomerWithDetails[];
  consultantsByCustomer: CustomerConsultantsByCustomerId;
  allConsultants: { id: string; name: string }[];
  error: string | null;
  isAdmin?: boolean;
};

function CustomerAvatar({
  customer,
  size = "sm",
}: {
  customer: CustomerWithDetails;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";

  if (customer.logoUrl) {
    return (
      <span
        className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-subtle bg-bg-default`}
      >
        {/* Customer logos are user-provided remote URLs without a shared image loader. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={customer.logoUrl}
          alt=""
          className="h-full w-full object-contain p-1"
        />
      </span>
    );
  }

  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-semibold text-text-inverse`}
      style={{ backgroundColor: customer.color }}
      aria-hidden
    >
      {customer.initials}
    </span>
  );
}

export function CustomersPageClient({
  customers,
  consultantsByCustomer,
  allConsultants,
  error,
  isAdmin = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const routeId = useMemo(() => {
    const prefix = `${ROUTES.customers}/`;
    if (!pathname.startsWith(prefix)) return null;
    const rest = pathname.slice(prefix.length);
    if (!rest || rest.includes("/")) return null;
    return rest;
  }, [pathname]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] =
    useState<CustomerFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");

  const counts = useMemo(
    () => ({
      all: customers.length,
      active: customers.filter((customer) => customer.isActive).length,
      inactive: customers.filter((customer) => !customer.isActive).length,
      internal: customers.filter((customer) => customer.isInternal).length,
    }),
    [customers]
  );

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = customers.filter((customer) => {
      if (customerFilter === "active" && !customer.isActive) return false;
      if (customerFilter === "inactive" && customer.isActive) return false;
      if (customerFilter === "internal" && !customer.isInternal) return false;
      if (!query) return true;
      return (
        customer.name.toLowerCase().includes(query) ||
        (customer.accountManagerName ?? "").toLowerCase().includes(query) ||
        (customer.contactName ?? "").toLowerCase().includes(query) ||
        (customer.contactEmail ?? "").toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      switch (sortKey) {
        case "accountManager":
          return (
            direction *
              (a.accountManagerName ?? "").localeCompare(
                b.accountManagerName ?? ""
              ) || a.name.localeCompare(b.name)
          );
        case "activeProjects":
          return (
            direction * (a.activeProjectCount - b.activeProjectCount) ||
            a.name.localeCompare(b.name)
          );
        case "type":
          return (
            direction * Number(a.isInternal) - direction * Number(b.isInternal) ||
            a.name.localeCompare(b.name)
          );
        case "status":
          return (
            direction * Number(a.isActive) - direction * Number(b.isActive) ||
            a.name.localeCompare(b.name)
          );
        default:
          return direction * a.name.localeCompare(b.name);
      }
    });
  }, [customerFilter, customers, search, sortDirection, sortKey]);

  const selectedCustomer =
    routeId == null
      ? null
      : customers.find((customer) => customer.id === routeId) ?? null;
  const assignedConsultants: CustomerConsultant[] =
    selectedCustomer == null
      ? []
      : consultantsByCustomer[selectedCustomer.id] ?? [];

  const columns: DataTableColumn<CustomerWithDetails>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      cell: (customer) => (
        <span className="flex min-w-0 items-center gap-3">
          <CustomerAvatar customer={customer} />
          <span className="truncate">{customer.name}</span>
        </span>
      ),
    },
    {
      id: "accountManager",
      header: "Account manager",
      sortable: true,
      secondary: true,
      cell: (customer) => customer.accountManagerName ?? "—",
    },
    {
      id: "activeProjects",
      header: "Active projects",
      sortable: true,
      align: "right",
      cell: (customer) => (
        <span className="tabular-nums">{customer.activeProjectCount}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortable: true,
      secondary: true,
      cell: (customer) => (customer.isInternal ? "Internal" : "Standard"),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (customer) => (
        <Badge
          variant={customer.isActive ? "active" : "inactive"}
          className="px-2 py-0.5"
        >
          {customer.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  function handleSort(columnId: string) {
    const key = columnId as SortKey;
    if (sortKey === key) {
      setSortDirection((direction) =>
        direction === "asc" ? "desc" : "asc"
      );
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  const customerFilterOptions = useMemo(
    () => [
      { value: "all" as const, label: "All", count: counts.all },
      { value: "active" as const, label: "Active", count: counts.active },
      { value: "inactive" as const, label: "Inactive", count: counts.inactive },
      { value: "internal" as const, label: "Internal", count: counts.internal },
    ],
    [counts]
  );

  function openCustomer(id: string) {
    router.push(customerHref(id), { scroll: false });
  }

  function closeDrawer() {
    router.push(ROUTES.customers, { scroll: false });
  }

  return (
    <>
      <AddCustomerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => router.refresh()}
      />

      <div className="flex flex-col gap-8">
        <PageHeader
          title="Customers"
          description="Manage customer organizations, projects and assignments."
        >
          <Button
            type="button"
            variant="primary"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add customer
          </Button>
        </PageHeader>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            Error: {error}
          </p>
        ) : null}

        {!error && customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Add your first customer to start creating projects and managing rates."
            actionLabel="Add customer"
            onAction={() => setAddModalOpen(true)}
          />
        ) : null}

        {!error && customers.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  type="search"
                  placeholder="Search customers…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search customers"
                  className="pl-9"
                />
              </div>
              <SegmentedControl
                className="min-w-0 flex-1"
                aria-label="Filter customers"
                value={customerFilter}
                onChange={setCustomerFilter}
                options={customerFilterOptions}
              />
            </div>

            {visibleCustomers.length === 0 ? (
              <p className="px-1 py-6 text-sm text-text-secondary">
                No customers match this filter.
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={visibleCustomers}
                getRowId={(customer) => customer.id}
                onRowClick={(customer) => openCustomer(customer.id)}
                selectedRowId={routeId ?? undefined}
                sort={{
                  columnId: sortKey,
                  direction: sortDirection,
                  onSort: handleSort,
                }}
              />
            )}
          </>
        ) : null}
      </div>

      <SideDrawer
        open={routeId != null}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
        title={selectedCustomer?.name ?? "Customer"}
        header={
          selectedCustomer ? (
            <div className="flex items-start gap-3">
              <CustomerAvatar customer={selectedCustomer} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <p className="text-heading-l leading-tight text-text-primary">
                    {selectedCustomer.name}
                  </p>
                  <Badge
                    variant={
                      selectedCustomer.isActive ? "active" : "inactive"
                    }
                    className="px-2 py-0.5"
                  >
                    {selectedCustomer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  {selectedCustomer.isInternal
                    ? "Internal customer"
                    : "Standard customer"}
                </p>
              </div>
            </div>
          ) : undefined
        }
        bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
      >
        {selectedCustomer ? (
          <CustomerDrawerContent
            key={selectedCustomer.id}
            customer={selectedCustomer}
            assignedConsultants={assignedConsultants}
            allConsultants={allConsultants}
            isAdmin={isAdmin}
          />
        ) : routeId != null ? (
          <p className="px-6 py-4 text-sm text-text-secondary">
            Customer not found.
          </p>
        ) : null}
      </SideDrawer>
    </>
  );
}
