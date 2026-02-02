"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { ConsultantsPageHeader } from "./ConsultantsPageHeader";
import { EmptyState, Panel } from "@/components/ui";
import { AddConsultantModal } from "./AddConsultantModal";
import type { ConsultantWithDetails } from "@/types";

type SortKey = "name" | "team";
type SortDir = "asc" | "desc";

const TABLE_COL_WIDTHS = { name: "70%", team: "30%" };
const tableBorder = "border-panel";

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
      <td className={`border-b ${tableBorder} px-4 py-3`}>
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
      <td className={`border-b ${tableBorder} px-4 py-3 text-text-primary opacity-90`}>
        {consultant.teamName ?? "—"}
      </td>
    </tr>
  );
}

function ConsultantTableHeader({
  sortKey,
  sortDir,
  toggleSort,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  toggleSort: (key: SortKey) => void;
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
      <tr className={`border-b ${tableBorder} bg-bg-muted/80`}>
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
        <th className="px-4 py-3 text-left" style={{ width: TABLE_COL_WIDTHS.team }}>
          <button
            type="button"
            onClick={() => toggleSort("team")}
            className="flex items-center font-medium text-text-primary hover:opacity-80"
          >
            Team
            <SortIcon column="team" />
          </button>
        </th>
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
        case "team":
          cmp = (a.teamName ?? "").localeCompare(b.teamName ?? "");
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
          (c.teamName?.toLowerCase().includes(q))
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

      {!error && consultants.length === 0 && (
        <EmptyState
          title="No consultants yet"
          description="Add your first consultant to start planning allocations."
          actionLabel="Add consultant"
          onAction={() => setAddModalOpen(true)}
        />
      )}

      {!error && consultants.length > 0 && (
        <>
          <div className="mt-6 border-b border-border bg-panel rounded-panel border p-4" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
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
            <div className="mt-6 rounded-panel border p-12 text-center text-sm text-text-primary opacity-70" style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}>
              No consultants match &quot;{search}&quot;
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <Panel>
                <h2 className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-base font-semibold text-text-primary`}>
                  Internal consultants
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[200px] table-fixed text-sm" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: TABLE_COL_WIDTHS.name }} />
                      <col style={{ width: TABLE_COL_WIDTHS.team }} />
                    </colgroup>
                    <ConsultantTableHeader
                      sortKey={sortKey}
                      sortDir={sortDir}
                      toggleSort={toggleSort}
                    />
                    <tbody>
                      {internal.length === 0 ? (
                        <tr>
                          <td colSpan={2} className={`border-b ${tableBorder} px-4 py-6 text-center text-sm text-text-primary opacity-60`}>
                            No internal consultants
                          </td>
                        </tr>
                      ) : (
                        internal.map((consultant) => (
                          <ConsultantTableRow
                            key={consultant.id}
                            consultant={consultant}
                            showExternalBadge={false}
                            onRowClick={(id) => router.push(`/consultants/${id}`)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel>
                <h2 className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-base font-semibold text-text-primary`}>
                  External consultants
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[200px] table-fixed text-sm" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: TABLE_COL_WIDTHS.name }} />
                      <col style={{ width: TABLE_COL_WIDTHS.team }} />
                    </colgroup>
                    <ConsultantTableHeader
                      sortKey={sortKey}
                      sortDir={sortDir}
                      toggleSort={toggleSort}
                    />
                    <tbody>
                      {external.length === 0 ? (
                        <tr>
                          <td colSpan={2} className={`border-b ${tableBorder} px-4 py-6 text-center text-sm text-text-primary opacity-60`}>
                            No external consultants
                          </td>
                        </tr>
                      ) : (
                        external.map((consultant) => (
                          <ConsultantTableRow
                            key={consultant.id}
                            consultant={consultant}
                            showExternalBadge
                            onRowClick={(id) => router.push(`/consultants/${id}`)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </>
  );
}
