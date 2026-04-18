"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, History, Pencil, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmModal,
  Dialog,
  IconButton,
  OptionSegments,
  editInputClass,
} from "@/components/ui";
import {
  CUSTOMER_STATUS_BODY_MAX_LENGTH,
  type CustomerStatusEntrySerialized,
  type CustomerStatusRowProps,
  type TrafficLight,
} from "@/lib/customerStatusShared";
import {
  addCustomerStatusEntryAction,
  deleteCustomerStatusEntryAction,
  getCustomerStatusHistoryAction,
  updateCustomerStatusEntryAction,
} from "./actions";

export type { CustomerStatusRowProps };

const TRAFFIC_OPTIONS: { value: TrafficLight; label: string }[] = [
  { value: "red", label: "Red" },
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
];

function weekLabel(year: number, week: number) {
  return `${year} · W${String(week).padStart(2, "0")}`;
}

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function TrafficDot({ light }: { light: TrafficLight }) {
  const color =
    light === "red"
      ? "bg-red-500"
      : light === "yellow"
        ? "bg-amber-400"
        : "bg-emerald-500";
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`}
      title={light}
      aria-hidden
    />
  );
}

/** Leading column: latest traffic colour, or neutral grey when there is no entry. */
function TrafficLightLead({
  latest,
}: {
  latest: CustomerStatusEntrySerialized | null;
}) {
  const hasStatus = latest != null;
  const label = hasStatus
    ? `Traffic: ${latest.traffic_light}`
    : "No status recorded yet";
  return (
    <span
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full border border-border-subtle bg-bg-muted/40 sm:mt-0 sm:self-center"
      title={label}
      aria-label={label}
    >
      {hasStatus ? (
        <span
          className={`block h-4 w-4 rounded-full ${
            latest.traffic_light === "red"
              ? "bg-red-500"
              : latest.traffic_light === "yellow"
                ? "bg-amber-400"
                : "bg-emerald-500"
          }`}
        />
      ) : (
        <span className="block h-4 w-4 rounded-full bg-text-muted/25" />
      )}
    </span>
  );
}

type Props = {
  initialRows: CustomerStatusRowProps[];
};

export function CustomerStatusPageClient({ initialRows }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(
    null
  );
  const [historyName, setHistoryName] = useState("");
  const [historyEntries, setHistoryEntries] = useState<
    CustomerStatusEntrySerialized[] | null
  >(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    id: string;
    traffic: TrafficLight;
    body: string;
  } | null>(null);
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    weekLabel: string;
  } | null>(null);

  const [forms, setForms] = useState<
    Record<string, { traffic: TrafficLight; body: string }>
  >({});

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();

  function getForm(customerId: string, defaultLight: TrafficLight) {
    return (
      forms[customerId] ?? {
        traffic: defaultLight,
        body: "",
      }
    );
  }

  function setForm(
    customerId: string,
    patch: Partial<{ traffic: TrafficLight; body: string }>
  ) {
    setForms((prev) => {
      const row = rows.find((r) => r.customerId === customerId);
      const defaultLight: TrafficLight = row?.latest?.traffic_light ?? "yellow";
      const cur = prev[customerId] ?? { traffic: defaultLight, body: "" };
      return {
        ...prev,
        [customerId]: { ...cur, ...patch },
      };
    });
  }

  async function refreshHistoryList(customerId: string) {
    const res = await getCustomerStatusHistoryAction(customerId);
    if (!res.ok) {
      setHistoryError(res.error);
      return;
    }
    setHistoryEntries(res.entries);
    const newest = res.entries[0] ?? null;
    setRows((prev) =>
      prev.map((r) =>
        r.customerId === customerId ? { ...r, latest: newest } : r
      )
    );
  }

  async function openHistory(customerId: string, name: string) {
    setEditDraft(null);
    setEditSaveError(null);
    setDeleteTarget(null);
    setHistoryCustomerId(customerId);
    setHistoryName(name);
    setHistoryEntries(null);
    setHistoryError(null);
    setHistoryLoading(true);
    const res = await getCustomerStatusHistoryAction(customerId);
    setHistoryLoading(false);
    if (res.ok) {
      setHistoryEntries(res.entries);
    } else {
      setHistoryError(res.error);
    }
  }

  function closeHistory(open: boolean) {
    if (!open) {
      setHistoryCustomerId(null);
      setHistoryEntries(null);
      setHistoryError(null);
      setEditDraft(null);
      setEditSaveError(null);
      setDeleteTarget(null);
    }
  }

  function collapseExpand() {
    setExpandedId(null);
    setSaveError(null);
  }

  /** Blank comment; traffic defaults from latest or yellow. */
  function expandForNew(customerId: string) {
    if (expandedId === customerId) {
      collapseExpand();
      return;
    }
    setSaveError(null);
    const row = rows.find((r) => r.customerId === customerId);
    const defaultLight: TrafficLight = row?.latest?.traffic_light ?? "yellow";
    setForms((prev) => ({
      ...prev,
      [customerId]: { traffic: defaultLight, body: "" },
    }));
    setExpandedId(customerId);
  }

  function submit(customerId: string) {
    const row = rows.find((r) => r.customerId === customerId);
    const defaultLight: TrafficLight = row?.latest?.traffic_light ?? "yellow";
    const f = getForm(customerId, defaultLight);

    setSaveError(null);
    startTransition(async () => {
      const result = await addCustomerStatusEntryAction(
        customerId,
        f.traffic,
        f.body
      );
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      const historyRes = await getCustomerStatusHistoryAction(customerId);
      if (historyRes.ok && historyRes.entries[0]) {
        const newest = historyRes.entries[0];
        setRows((prev) =>
          prev.map((r) =>
            r.customerId === customerId ? { ...r, latest: newest } : r
          )
        );
      } else {
        router.refresh();
      }
      setForm(customerId, { body: "" });
      collapseExpand();
    });
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No active customers.</p>
      ) : null}

      {rows.map((row) => {
        const isOpen = expandedId === row.customerId;
        const defaultLight: TrafficLight = row.latest?.traffic_light ?? "yellow";
        const f = getForm(row.customerId, defaultLight);

        return (
          <div
            key={row.customerId}
            className="rounded-lg border border-border-subtle bg-bg-default"
          >
            <div className="flex flex-wrap items-start gap-3 px-3 py-3 sm:items-center">
              <TrafficLightLead latest={row.latest} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-primary">
                    {row.customerName}
                  </span>
                  {row.latest ? (
                    <span className="text-xs tabular-nums text-text-muted">
                      {weekLabel(row.latest.year, row.latest.week)}
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">
                      No status recorded
                    </span>
                  )}
                </div>
                {row.latest ? (
                  <p className="mt-1 text-sm leading-snug text-text-primary/90 whitespace-pre-wrap">
                    {row.latest.body}
                  </p>
                ) : null}
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-0.5 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => expandForNew(row.customerId)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-text-primary/80 transition-colors hover:bg-bg-muted hover:text-text-primary"
                >
                  {isOpen ? (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Close
                    </>
                  ) : (
                    "New status"
                  )}
                </button>
                <IconButton
                  type="button"
                  aria-label={`History for ${row.customerName}`}
                  title="History"
                  onClick={() => void openHistory(row.customerId, row.customerName)}
                >
                  <History className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            {isOpen ? (
              <div className="space-y-3 border-t border-border-subtle px-3 py-3 sm:px-4">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-text-muted">
                    Traffic light
                  </p>
                  <OptionSegments
                    name={`traffic-${row.customerId}`}
                    options={TRAFFIC_OPTIONS}
                    value={f.traffic}
                    onChange={(v) =>
                      setForm(row.customerId, {
                        traffic: v as TrafficLight,
                      })
                    }
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`body-${row.customerId}`}
                    className="mb-1.5 block text-xs font-medium text-text-muted"
                  >
                    Comment
                  </label>
                  <textarea
                    id={`body-${row.customerId}`}
                    rows={3}
                    maxLength={CUSTOMER_STATUS_BODY_MAX_LENGTH}
                    value={f.body}
                    onChange={(e) =>
                      setForm(row.customerId, { body: e.target.value })
                    }
                    disabled={isPending}
                    placeholder="Required — describe the current customer status."
                    className={`${editInputClass} resize-y min-h-[4.5rem]`}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    {f.body.trim().length}/{CUSTOMER_STATUS_BODY_MAX_LENGTH}
                  </p>
                </div>
                {saveError ? (
                  <p className="text-sm text-danger" role="alert">
                    {saveError}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isPending}
                    onClick={() => collapseExpand()}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isPending || !f.body.trim()}
                    onClick={() => submit(row.customerId)}
                  >
                    {isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      <Dialog
        open={historyCustomerId !== null}
        onOpenChange={closeHistory}
        title={editDraft ? "Edit status" : historyName || "History"}
        subtitle="Customer status"
        contentClassName="fixed left-1/2 top-1/2 z-50 w-full max-w-[min(100vw-2rem,44rem)] max-h-[min(90vh,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-border-subtle bg-bg-default p-6 shadow-[0_14px_36px_rgba(0,0,0,0.12)] focus:outline-none flex flex-col"
        titleClassName="pr-10 text-lg"
      >
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {editDraft && historyCustomerId ? (
            <div className="space-y-4">
              <button
                type="button"
                disabled={isHistoryPending}
                onClick={() => {
                  setEditDraft(null);
                  setEditSaveError(null);
                }}
                className="text-xs font-medium text-text-primary/80 underline-offset-2 hover:text-text-primary hover:underline disabled:opacity-50"
              >
                ← Back to history
              </button>
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-muted">
                  Traffic light
                </p>
                <OptionSegments
                  name="history-edit-traffic"
                  options={TRAFFIC_OPTIONS}
                  value={editDraft.traffic}
                  onChange={(v) =>
                    setEditDraft((d) =>
                      d ? { ...d, traffic: v as TrafficLight } : null
                    )
                  }
                  disabled={isHistoryPending}
                />
              </div>
              <div>
                <label
                  htmlFor="history-edit-body"
                  className="mb-1.5 block text-xs font-medium text-text-muted"
                >
                  Comment
                </label>
                <textarea
                  id="history-edit-body"
                  rows={4}
                  maxLength={CUSTOMER_STATUS_BODY_MAX_LENGTH}
                  value={editDraft.body}
                  onChange={(e) =>
                    setEditDraft((d) =>
                      d ? { ...d, body: e.target.value } : null
                    )
                  }
                  disabled={isHistoryPending}
                  className={`${editInputClass} resize-y min-h-[5rem]`}
                />
                <p className="mt-1 text-xs text-text-muted">
                  {editDraft.body.trim().length}/{CUSTOMER_STATUS_BODY_MAX_LENGTH}
                </p>
              </div>
              {editSaveError ? (
                <p className="text-sm text-danger" role="alert">
                  {editSaveError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isHistoryPending}
                  onClick={() => {
                    setEditDraft(null);
                    setEditSaveError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isHistoryPending || !editDraft.body.trim()}
                  onClick={() => {
                    const draft = editDraft;
                    const cid = historyCustomerId;
                    if (!draft || !cid) return;
                    setEditSaveError(null);
                    startHistoryTransition(async () => {
                      const res = await updateCustomerStatusEntryAction(
                        draft.id,
                        cid,
                        draft.traffic,
                        draft.body
                      );
                      if (!res.ok) {
                        setEditSaveError(res.error);
                        return;
                      }
                      setEditDraft(null);
                      await refreshHistoryList(cid);
                    });
                  }}
                >
                  {isHistoryPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : historyLoading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : historyError ? (
            <p className="text-sm text-danger" role="alert">
              {historyError}
            </p>
          ) : historyEntries && historyEntries.length === 0 ? (
            <p className="text-sm text-text-muted">No entries yet.</p>
          ) : historyEntries ? (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs text-text-muted">
                  <th className="py-2 pr-2 font-medium">Week</th>
                  <th className="py-2 pr-2 font-medium">Light</th>
                  <th className="py-2 pr-2 font-medium">Saved</th>
                  <th className="min-w-0 py-2 pr-2 font-medium">Comment</th>
                  <th className="w-px py-2 pl-2 text-right font-medium whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyEntries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border-subtle/80 align-top"
                  >
                    <td className="py-2 pr-2 tabular-nums text-text-muted">
                      {weekLabel(e.year, e.week)}
                    </td>
                    <td className="py-2 pr-2">
                      <TrafficDot light={e.traffic_light} />
                    </td>
                    <td className="py-2 pr-2 text-xs text-text-muted whitespace-nowrap">
                      {formatDateTime(e.created_at)}
                    </td>
                    <td className="min-w-0 py-2 pr-2 text-text-primary whitespace-pre-wrap">
                      {e.body}
                    </td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-0.5">
                        <IconButton
                          type="button"
                          aria-label="Edit this status"
                          title="Edit"
                          disabled={isHistoryPending}
                          onClick={() => {
                            setEditSaveError(null);
                            setEditDraft({
                              id: e.id,
                              traffic: e.traffic_light,
                              body: e.body,
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          type="button"
                          variant="ghostDanger"
                          aria-label="Delete this status"
                          title="Delete"
                          disabled={isHistoryPending}
                          onClick={() =>
                            setDeleteTarget({
                              id: e.id,
                              weekLabel: weekLabel(e.year, e.week),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </Dialog>

      <ConfirmModal
        isOpen={deleteTarget !== null && historyCustomerId !== null}
        title="Delete status"
        message={
          deleteTarget
            ? `Remove the status for ${deleteTarget.weekLabel}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget || !historyCustomerId) return;
          const res = await deleteCustomerStatusEntryAction(
            deleteTarget.id,
            historyCustomerId
          );
          if (!res.ok) {
            setHistoryError(res.error);
            return;
          }
          setHistoryError(null);
          await refreshHistoryList(historyCustomerId);
        }}
      />
    </div>
  );
}
