"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ConsultantsPageHeader } from "./ConsultantsPageHeader";
import { ConsultantCard } from "./ConsultantCard";
import { EmptyState } from "@/components/ui";
import { AddConsultantModal } from "./AddConsultantModal";
import type { ConsultantWithDetails } from "@/types";

type Props = {
  consultants: ConsultantWithDetails[];
  error: string | null;
};

export function ConsultantsPageClient({ consultants, error }: Props) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hideExternals, setHideExternals] = useState(false);

  const filteredConsultants = useMemo(() => {
    let result = consultants;
    if (hideExternals) {
      result = result.filter((c) => !c.isExternal);
    }
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
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [consultants, search, hideExternals]);

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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-primary opacity-50" />
            <input
              type="search"
              placeholder="Search consultants…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal sm:max-w-xs"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideExternals}
              onChange={(e) => setHideExternals(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand-signal focus:ring-2 focus:ring-brand-signal focus:ring-offset-0"
            />
            <span className="text-sm text-text-primary">Dölj externa</span>
          </label>
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
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {          filteredConsultants.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-text-primary opacity-70">
              {search || hideExternals
                ? "No consultants match the current filters"
                : "No consultants"}
            </p>
          ) : (
            filteredConsultants.map((consultant) => (
            <ConsultantCard key={consultant.id} consultant={consultant} />
            ))
          )}
        </div>
      )}
    </>
  );
}
