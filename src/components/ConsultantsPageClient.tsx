"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { ConsultantsPageHeader } from "./ConsultantsPageHeader";
import { EmptyState } from "@/components/ui";
import { AddConsultantModal } from "./AddConsultantModal";
import type { ConsultantWithDetails } from "@/types";

type SortKey = "name" | "role" | "team" | "workload" | "allocation" | "email";
type SortDir = "asc" | "desc";

function ConsultantsTable({
  consultants,
  SortIcon,
  toggleSort,
  onRowClick,
  showExternalBadge = false,
}: {
  consultants: ConsultantWithDetails[];
  sortKey?: SortKey;
  sortDir?: SortDir;
  SortIcon: ({ column }: { column: SortKey }) => React.ReactNode;
  toggleSort: (key: SortKey) => void;
  onRowClick: (id: string) => void;
  showExternalBadge?: boolean;
}) {
  const weekNum = consultants[0]?.weekNumber ?? "—";
  return (
    <table className="w-full min-w-[640px] text-sm">
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
              onClick={() => toggleSort("role")}
              className="flex items-center font-medium text-text-primary hover:opacity-80"
            >
              Role
              <SortIcon column="role" />
            </button>
          </th>
          <th className="px-4 py-3 text-left">
            <button
              type="button"
              onClick={() => toggleSort("team")}
              className="flex items-center font-medium text-text-primary hover:opacity-80"
            >
              Team
              <SortIcon column="team" />
            </button>
          </th>
          <th className="px-4 py-3 text-left">
            <button
              type="button"
              onClick={() => toggleSort("workload")}
              className="flex items-center font-medium text-text-primary hover:opacity-80"
            >
              Workload
              <SortIcon column="workload" />
            </button>
          </th>
          <th className="px-4 py-3 text-left">
            <button
              type="button"
              onClick={() => toggleSort("allocation")}
              className="flex items-center font-medium text-text-primary hover:opacity-80"
            >
              Week {weekNum} allocation
              <SortIcon column="allocation" />
            </button>
          </th>
          <th className="px-4 py-3 text-left">
            <button
              type="button"
              onClick={() => toggleSort("email")}
              className="flex items-center font-medium text-text-primary hover:opacity-80"
            >
              Email
              <SortIcon column="email" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {consultants.map((consultant) => {
          const percent = consultant.allocationPercent;
          const barColor = percent >= 100 ? "bg-danger" : "bg-accent-2";
          const barWidth = Math.min(percent, 100);
          return (
            <tr
              key={consultant.id}
              className="cursor-pointer transition-colors hover:bg-bg-muted/50"
              onClick={() => onRowClick(consultant.id)}
            >
              <td className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-2 font-medium text-text-primary">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs font-medium text-text-primary opacity-80">
                    {consultant.initials}
                  </div>
                  {consultant.name}
                  {showExternalBadge && (
                    <span className="rounded bg-brand-blue/60 px-1.5 py-0.5 text-xs font-medium text-text-primary">
                      External
                    </span>
                  )}
                </div>
              </td>
              <td className="border-b border-border px-4 py-3 text-text-primary opacity-90">
                {consultant.roleName}
              </td>
              <td className="border-b border-border px-4 py-3 text-text-primary opacity-90">
                {consultant.teamName ?? "—"}
              </td>
              <td className="border-b border-border px-4 py-3 text-text-primary opacity-90">
                {consultant.hoursPerWeek}h/week
                {consultant.workPercentage !== 100 ? ` (${consultant.workPercentage}%)` : ""}
              </td>
              <td className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-bg-muted">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-text-primary opacity-90">
                    {consultant.totalHoursAllocated}h ({percent}%)
                  </span>
                </div>
              </td>
              <td className="border-b border-border px-4 py-3">
                {consultant.email ? (
                  <a
                    href={`mailto:${consultant.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-brand-signal hover:underline"
                    tabIndex={0}
                  >
                    {consultant.email}
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
  );
}

type Props = {
  consultants: ConsultantWithDetails[];
  error: string | null;
};

export function ConsultantsPageClient({ consultants, error }: Props) {
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

  const sortConsultants = (list: ConsultantWithDetails[]) =>
    [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "role":
          cmp = a.roleName.localeCompare(b.roleName);
          break;
        case "team":
          cmp = (a.teamName ?? "").localeCompare(b.teamName ?? "");
          break;
        case "workload":
          cmp = a.hoursPerWeek - b.hoursPerWeek;
          break;
        case "allocation":
          cmp = a.allocationPercent - b.allocationPercent;
          break;
        case "email":
          cmp = (a.email ?? "").localeCompare(b.email ?? "");
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const { internal, external } = useMemo(() => {
    let result = consultants;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email?.toLowerCase().includes(q)) ||
          c.roleName.toLowerCase().includes(q) ||
          c.calendarName.toLowerCase().includes(q)
      );
    }
    const internal = sortConsultants(result.filter((c) => !c.isExternal));
    const external = sortConsultants(result.filter((c) => c.isExternal));
    return { internal, external };
  }, [consultants, search, sortKey, sortDir]);

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <ConsultantsPageHeader
        count={consultants.length}
        onAdd={() => setAddModalOpen(true)}
      />

      <AddConsultantModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {error && (
        <p className="mt-6 text-sm text-danger">Error: {error}</p>
      )}

      {!error && consultants.length > 0 && (
        <div className="mt-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-primary opacity-50" />
            <input
              type="search"
              placeholder="Search consultants…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
            />
          </div>
        </div>
      )}

      {!error && consultants.length === 0 && (
        <EmptyState
          title="No consultants yet"
          description="Add your first consultant to start managing allocations and project assignments."
          actionLabel="Add consultant"
          onAction={() => setAddModalOpen(true)}
        />
      )}

      {!error && consultants.length > 0 && (
        <div className="mt-6 space-y-8">
          {internal.length === 0 && external.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-primary opacity-70">
              {search ? "No consultants match the current filters" : "No consultants"}
            </p>
          ) : (
            <>
              {internal.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-60">
                    Internal
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-border bg-bg-default">
                    <div className="overflow-x-auto">
                      <ConsultantsTable
                        consultants={internal}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        SortIcon={SortIcon}
                        toggleSort={toggleSort}
                        onRowClick={(id) => router.push(`/consultants/${id}`)}
                      />
                    </div>
                  </div>
                </div>
              )}
              {external.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-60">
                    External
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-border bg-bg-default">
                    <div className="overflow-x-auto">
                      <ConsultantsTable
                        consultants={external}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        SortIcon={SortIcon}
                        toggleSort={toggleSort}
                        onRowClick={(id) => router.push(`/consultants/${id}`)}
                        showExternalBadge
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
