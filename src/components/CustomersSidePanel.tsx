"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X } from "lucide-react";
import { getCustomersListAction } from "@/app/(app)/customers/actions";
import { useSidePanel } from "@/contexts/SidePanelContext";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";
import type { CustomerWithDetails } from "@/types";
import { AddCustomerModal } from "./AddCustomerModal";

const PANEL_WIDTH = "16.8rem"; /* ~20% wider than 14rem */

export function CustomersSidePanel() {
  const pathname = usePathname();
  const { closePanel, registerRefreshCustomers } = useSidePanel();
  const [customers, setCustomers] = useState<CustomerWithDetails[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const selectedCustomerId =
    pathname?.startsWith("/customers/") && pathname !== "/customers"
      ? pathname.split("/")[2] ?? null
      : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getCustomersListAction();
      setCustomers(list);
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
    registerRefreshCustomers(load);
    return () => registerRefreshCustomers(() => {});
  }, [registerRefreshCustomers, load]);

  const visible = customers.filter((c) => showInactive || c.isActive);
  const sorted = [...visible].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const inactiveCount = customers.filter((c) => !c.isActive).length;

  return (
    <aside
      className="flex h-screen flex-shrink-0 flex-col border-r border-border-subtle bg-bg-default"
      style={{ width: PANEL_WIDTH }}
    >
      <div className="flex flex-shrink-0 items-center justify-between gap-1 border-b border-border-subtle px-2 py-1.5">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-text-primary opacity-80">
          Customers
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
          aria-label="Add customer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add customer
        </button>
      </div>

      <AddCustomerModal
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
        {!loading && !error && sorted.length === 0 && (
          <p className="py-2 text-center text-xs text-text-primary opacity-60">
            {showInactive ? "No customers" : "No active customers"}
          </p>
        )}
        {!loading && !error && sorted.length > 0 && (
          <ul className="space-y-0.5">
            {sorted.map((c) => {
              const color = c.color || DEFAULT_CUSTOMER_COLOR;
              const faviconUrl =
                c.url && c.url.trim() !== ""
                  ? `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(c.url.trim())}&size=64`
                  : null;
              return (
                <li key={c.id}>
                  <Link
                    href={`/customers/${c.id}`}
                    className={`flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-bg-muted/50 ${selectedCustomerId === c.id ? "bg-nav-active" : ""} ${!c.isActive ? "opacity-60" : ""}`}
                  >
                    {faviconUrl ? (
                      <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded bg-bg-muted">
                        <img
                          src={faviconUrl}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-medium text-text-inverse"
                        style={{ backgroundColor: color }}
                      >
                        {c.initials}
                      </div>
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs text-text-primary">
                      {c.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
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
