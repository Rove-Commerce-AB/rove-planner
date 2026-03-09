"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ConsultantsPageHeader } from "./ConsultantsPageHeader";
import { EmptyState, IconButton, Panel, PanelSectionTitle } from "@/components/ui";
import { AddConsultantModal } from "./AddConsultantModal";
import type { ConsultantWithDetails } from "@/types";

type Props = {
  consultants: ConsultantWithDetails[];
  error: string | null;
};

export function ConsultantsPageClient({ consultants, error }: Props) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);

  const consultantsByTeam = useMemo(() => {
    const map = new Map<string, ConsultantWithDetails[]>();
    for (const c of consultants) {
      const key = c.teamName?.trim() || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.isExternal !== b.isExternal) return a.isExternal ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    }
    const noTeamKey = "—";
    const entries = [...map.entries()].sort(([a], [b]) => {
      if (a === noTeamKey) return 1;
      if (b === noTeamKey) return -1;
      return a.localeCompare(b);
    });
    return entries;
  }, [consultants]);

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <ConsultantsPageHeader count={consultants.length} />

      <AddConsultantModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {error && (
        <p className="mt-6 text-sm text-danger" role="alert">
          Error: {error}
        </p>
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
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2">
          <Panel>
            <PanelSectionTitle
              action={
                <IconButton
                  aria-label="Add consultant"
                  onClick={() => setAddModalOpen(true)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <Plus className="h-4 w-4" />
                </IconButton>
              }
            >
              CONSULTANTS
            </PanelSectionTitle>
            <div className="overflow-x-auto p-3 pt-0">
              <div className="space-y-4">
                {consultantsByTeam.map(([teamName, teamConsultants]) => (
                  <div key={teamName}>
                    <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-text-primary opacity-65">
                      {teamName}
                    </p>
                    <ul className="space-y-0.5">
                      {teamConsultants.map((c) => (
                        <li
                          key={c.id}
                          className="flex h-[2.25rem] cursor-pointer items-center gap-3 rounded-md px-2 transition-colors hover:bg-bg-muted/50"
                          onClick={() => router.push(`/consultants/${c.id}`)}
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-bg-muted text-xs font-medium text-text-primary opacity-80">
                            {c.initials}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                            {c.name}
                          </span>
                          {c.isExternal && (
                            <span className="shrink-0 rounded-sm bg-brand-blue/60 px-1.5 py-0.5 text-xs font-medium text-text-primary">
                              External
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
