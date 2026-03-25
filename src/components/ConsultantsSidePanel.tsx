"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X, Globe } from "lucide-react";
import { getConsultantsListAction } from "@/app/(app)/consultants/actions";
import { useSidePanel } from "@/contexts/SidePanelContext";
import type { ConsultantListItem } from "@/lib/consultantsQueries";
import { AddConsultantModal } from "./AddConsultantModal";

const PANEL_WIDTH = "16.8rem"; /* ~20% wider than 14rem */

function groupByTeam(
  consultants: ConsultantListItem[]
): { teamName: string; consultants: ConsultantListItem[] }[] {
  const byTeam = new Map<string, ConsultantListItem[]>();
  const noTeam: ConsultantListItem[] = [];
  for (const c of consultants) {
    const key = c.teamName ?? "";
    if (key === "") {
      noTeam.push(c);
    } else {
      const list = byTeam.get(key) ?? [];
      list.push(c);
      byTeam.set(key, list);
    }
  }
  const teams = Array.from(byTeam.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([teamName, consultants]) => ({ teamName, consultants }));
  if (noTeam.length > 0) {
    teams.push({ teamName: "—", consultants: noTeam });
  }
  return teams;
}

export function ConsultantsSidePanel() {
  const pathname = usePathname();
  const { closePanel, registerRefreshConsultants } = useSidePanel();
  const [consultants, setConsultants] = useState<ConsultantListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const selectedConsultantId =
    pathname?.startsWith("/consultants/") && pathname !== "/consultants"
      ? pathname.split("/")[2] ?? null
      : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getConsultantsListAction();
      setConsultants(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    registerRefreshConsultants(load);
    return () => registerRefreshConsultants(() => {});
  }, [registerRefreshConsultants, load]);

  const visible = consultants.filter((c) => showInactive || c.isActive);
  const inactiveCount = consultants.filter((c) => !c.isActive).length;
  const grouped = groupByTeam(
    [...visible].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
  );

  return (
    <aside
      className="flex h-screen flex-shrink-0 flex-col border-r border-border-subtle bg-bg-default"
      style={{ width: PANEL_WIDTH }}
    >
      <div className="flex flex-shrink-0 items-center justify-between gap-1 border-b border-border-subtle px-2 py-1.5">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-text-primary opacity-80">
          Consultants
        </span>
        <button
          type="button"
          onClick={closePanel}
          className="rounded p-1 text-text-primary opacity-70 hover:bg-bg-muted hover:opacity-100"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-shrink-0 border-b border-border-subtle px-2 py-1.5">
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-muted/50"
          aria-label="Add consultant"
        >
          <Plus className="h-3.5 w-3.5" />
          Add consultant
        </button>
      </div>

      <AddConsultantModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => load()}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading && (
          <p className="py-2 text-center text-xs text-text-primary opacity-60">
            Loading…
          </p>
        )}
        {error && (
          <p className="py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && grouped.length === 0 && (
          <p className="py-2 text-center text-xs text-text-primary opacity-60">
            {showInactive ? "No consultants" : "No active consultants"}
          </p>
        )}
        {!loading && !error && grouped.length > 0 && (
          <div className="space-y-3">
            {grouped.map(({ teamName, consultants: teamConsultants }) => (
              <div key={teamName}>
                <p className="mb-1 truncate px-1 text-[10px] font-medium uppercase tracking-wider text-text-primary opacity-60">
                  {teamName}
                </p>
                <ul className="space-y-0.5">
                  {teamConsultants.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/consultants/${c.id}`}
                        className={`flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-bg-muted/50 ${selectedConsultantId === c.id ? "bg-nav-active" : ""} ${!c.isActive ? "opacity-60" : ""}`}
                      >
                        <div
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-bg-muted text-[10px] font-medium text-text-primary"
                          aria-hidden
                        >
                          {c.initials}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs text-text-primary">
                          {c.name}
                        </span>
                        {c.isExternal && (
                          <Globe
                            className="h-3 w-3 flex-shrink-0 text-text-primary opacity-60"
                            aria-label="External"
                          />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {!loading && inactiveCount > 0 && (
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="mt-2 w-full rounded py-1.5 text-center text-[11px] font-medium text-text-primary opacity-70 transition-colors hover:bg-bg-muted/50 hover:opacity-100"
            aria-label={showInactive ? "Hide inactive" : "Show inactive"}
          >
            {showInactive ? "Hide inactive" : `Show inactive (${inactiveCount})`}
          </button>
        )}
      </div>
    </aside>
  );
}
