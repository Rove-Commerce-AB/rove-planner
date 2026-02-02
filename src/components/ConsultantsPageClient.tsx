"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, Pencil } from "lucide-react";
import Link from "next/link";
import { ConsultantsPageHeader } from "./ConsultantsPageHeader";
import { EmptyState, Panel } from "@/components/ui";
import { AddConsultantModal } from "./AddConsultantModal";
import type { ConsultantWithDetails } from "@/types";

type SortKey = "name" | "role" | "email" | "calendar" | "allocation";
type SortDir = "asc" | "desc";

// Shared column widths so Internal and External tables line up
const TABLE_COL_WIDTHS = {
  name: "20%",
  role: "12%",
  email: "18%",
  calendar: "12%",
  allocation: "14%",
  projects: "20%",
  actions: "4%",
};

function getAllocationPillClass(percent: number): string {
  if (percent >= 100) return "bg-danger/20 text-danger";
  if (percent < 85) return "bg-warning/20 text-warning";
  return "bg-success/20 text-success";
}

function formatProjects(consultant: ConsultantWithDetails): string {
  if (!consultant.projectAllocations?.length) return "—";
  return consultant.projectAllocations
    .map((p) => `${p.projectName} (${p.hours}h)`)
    .join(", ");
}

function ConsultantTableRow({
  consultant,
  showExternalBadge,
  onRowClick,
}: {
  consultant: ConsultantWithDetails;
  showExternalBadge: boolean;
  onRowClick: (id: string) => void;
}) {
  return (
    <tr
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
            <span className="rounded-sm bg-brand-blue/60 px-1.5 py-0.5 text-xs font-medium text-text-primary">
              External
            </span>
          )}
        </div>
      </td>
      <td className="border-b border-border px-4 py-3 text-text-primary opacity-90">
        {consultant.roleName}
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
      <td className="border-b border-border px-4 py-3 text-text-primary opacity-90">
        {consultant.calendarName}
      </td>
      <td className="border-b border-border px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${getAllocationPillClass(consultant.allocationPercent)}`}
        >
          {consultant.totalHoursAllocated}h ({consultant.allocationPercent}%)
        </span>
      </td>
      <td className="border-b border-border px-4 py-3 text-text-primary opacity-90">
        {formatProjects(consultant)}
      </td>
      <td className="border-b border-border px-4 py-3">
        <Link
          href={`/consultants/${consultant.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex rounded-sm p-1.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
          aria-label={`Edit ${consultant.name}`}
        >
          <Pencil className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function ConsultantTableHeader({
  sortKey,
  sortDir,
  toggleSort,
  weekLabel,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  toggleSort: (key: SortKey) => void;
  weekLabel: string;
}) {
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column)
      return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-50" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
    );
  };

  return (
    <thead>
      <tr className="border-b border-border bg-bg-muted/80">
        <th className="px-4 py-3 text-left" style={{ width: TABLE_COL_WIDTHS.name }}>
          <button
            type="button"
            onClick={() => toggleSort("name")}
            className="flex items-center font-medium text-text-primary hover:opacity-80"
          >
            Name
            <SortIcon column="name" />
          </button>
        </th>
        <th className="px-4 py-3 text-left" style={{ width: TABLE_COL_WIDTHS.role }}>
          <button
            type="button"
            onClick={() => toggleSort("role")}
            className="flex items-center font-medium text-text-primary hover:opacity-80"
          >
            Role
            <SortIcon column="role" />
          </button>
        </th>
        <th className="px-4 py-3 text-left" style={{ width: TABLE_COL_WIDTHS.email }}>
          <button
            type="button"
            onClick={() => toggleSort("email")}
            className="flex items-center font-medium text-text-primary hover:opacity-80"
          >
            Email
            <SortIcon column="email" />
          </button>
        </th>
        <th className="px-4 py-3 text-left" style={{ width: TABLE_COL_WIDTHS.calendar }}>
          <button
            type="button"
            onClick={() => toggleSort("calendar")}
            className="flex items-center font-medium text-text-primary hover:opacity-80"
          >
            Calendar
            <SortIcon column="calendar" />
          </button>
        </th>
        <th className="px-4 py-3 text-left" style={{ width: TABLE_COL_WIDTHS.allocation }}>
          <button
            type="button"
            onClick={() => toggleSort("allocation")}
            className="flex items-center font-medium text-text-primary hover:opacity-80"
          >
            {weekLabel}
            <SortIcon column="allocation" />
          </button>
        </th>
        <th className="px-4 py-3 text-left" style={{ width: TABLE_COL_WIDTHS.projects }}>
          Projects
        </th>
        <th className="px-4 py-3 text-left" style={{ width: TABLE_COL_WIDTHS.actions }} aria-label="Edit" />
      </tr>
    </thead>
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
        case "email":
          cmp = (a.email ?? "").localeCompare(b.email ?? "");
          break;
        case "calendar":
          cmp = a.calendarName.localeCompare(b.calendarName);
          break;
        case "allocation":
          cmp = a.allocationPercent - b.allocationPercent;
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
          c.email?.toLowerCase().includes(q) ||
          c.roleName.toLowerCase().includes(q) ||
          c.calendarName.toLowerCase().includes(q)
      );
    }
    const internal = sortConsultants(result.filter((c) => !c.isExternal));
    const external = sortConsultants(result.filter((c) => c.isExternal));
    return { internal, external };
  }, [consultants, search, sortKey, sortDir]);

  const weekLabel =
    internal[0] ?? external[0]
      ? `Week ${(internal[0] ?? external[0])!.weekNumber}`
      : "Week allocation";

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

      {!error && consultants.length === 0 && (
        <EmptyState
          title="No consultants yet"
          description="Add your first consultant to start planning allocations."
          actionLabel="Add consultant"
          onAction={() => setAddModalOpen(true)}
        />
      )}

      {!error && consultants.length > 0 && (
        <Panel className="mt-6">
          <div className="border-b border-border p-4">
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

          {internal.length === 0 && external.length === 0 ? (
            <div className="p-12 text-center text-sm text-text-primary opacity-70">
              No consultants match &quot;{search}&quot;
            </div>
          ) : (
            <>
              {internal.length > 0 && (
                <div className="border-b border-border">
                  <h2 className="border-b border-border bg-bg-muted/40 px-4 py-3 text-base font-semibold text-text-primary">
                    Internal consultants
                  </h2>
                  <div className="overflow-x-auto">
                    <table
                      className="w-full min-w-[720px] table-fixed text-sm"
                      style={{ tableLayout: "fixed" }}
                    >
                      <colgroup>
                        <col style={{ width: TABLE_COL_WIDTHS.name }} />
                        <col style={{ width: TABLE_COL_WIDTHS.role }} />
                        <col style={{ width: TABLE_COL_WIDTHS.email }} />
                        <col style={{ width: TABLE_COL_WIDTHS.calendar }} />
                        <col style={{ width: TABLE_COL_WIDTHS.allocation }} />
                        <col style={{ width: TABLE_COL_WIDTHS.projects }} />
                        <col style={{ width: TABLE_COL_WIDTHS.actions }} />
                      </colgroup>
                      <ConsultantTableHeader
                        sortKey={sortKey}
                        sortDir={sortDir}
                        toggleSort={toggleSort}
                        weekLabel={weekLabel}
                      />
                      <tbody>
                        {internal.map((consultant) => (
                          <ConsultantTableRow
                            key={consultant.id}
                            consultant={consultant}
                            showExternalBadge={false}
                            onRowClick={(id) => router.push(`/consultants/${id}`)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {external.length > 0 && (
                <div>
                  <h2 className="border-b border-border bg-bg-muted/40 px-4 py-3 text-base font-semibold text-text-primary">
                    External consultants
                  </h2>
                  <div className="overflow-x-auto">
                    <table
                      className="w-full min-w-[720px] table-fixed text-sm"
                      style={{ tableLayout: "fixed" }}
                    >
                      <colgroup>
                        <col style={{ width: TABLE_COL_WIDTHS.name }} />
                        <col style={{ width: TABLE_COL_WIDTHS.role }} />
                        <col style={{ width: TABLE_COL_WIDTHS.email }} />
                        <col style={{ width: TABLE_COL_WIDTHS.calendar }} />
                        <col style={{ width: TABLE_COL_WIDTHS.allocation }} />
                        <col style={{ width: TABLE_COL_WIDTHS.projects }} />
                        <col style={{ width: TABLE_COL_WIDTHS.actions }} />
                      </colgroup>
                      <ConsultantTableHeader
                        sortKey={sortKey}
                        sortDir={sortDir}
                        toggleSort={toggleSort}
                        weekLabel={weekLabel}
                      />
                      <tbody>
                        {external.map((consultant) => (
                          <ConsultantTableRow
                            key={consultant.id}
                            consultant={consultant}
                            showExternalBadge
                            onRowClick={(id) => router.push(`/consultants/${id}`)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>
      )}
    </>
  );
}
