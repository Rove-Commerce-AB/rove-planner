"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  FieldValue,
  InlineEditFieldContainer,
  InlineEditTrigger,
  InlineEditStatus,
  type InlineEditStatusState,
  SAVED_DURATION_MS,
  editInputClass,
} from "@/components/ui";
import {
  pmSetInvoicingStatus,
  pmSetInvoicingStatusBulk,
  pmUpdateTimeEntry,
  getProjectManagerTimeEntries,
} from "./actions";
import type { ProjectManagerEntry } from "@/types";
import { getMonthLabel } from "@/lib/dateUtils";
import { TIME_REPORT_MONTH_NAMES } from "../timeReportShared";

type Customer = { id: string; name: string };
type Project = {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
};

export function ProjectManagerTimeReportClient({
  isAdmin,
  consultantId,
  customers,
  projects,
  initialYear,
  initialMonth,
}: {
  isAdmin: boolean;
  consultantId: string | null;
  customers: Customer[];
  projects: Project[];
  initialYear: number;
  initialMonth: number;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customers[0]?.id ?? ""
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [entries, setEntries] = useState<ProjectManagerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type InlineField = "pmHours" | "pmComment";
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<InlineField | null>(null);
  const [editHoursStr, setEditHoursStr] = useState("");
  const [editCommentStr, setEditCommentStr] = useState("");
  const [inlineEditStatus, setInlineEditStatus] = useState<InlineEditStatusState>("idle");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const lastSavedFieldRef = useRef<InlineField | null>(null);
  const lastSavedEntryIdRef = useRef<string | null>(null);

  const canEdit = Boolean(consultantId) || isAdmin;

  useEffect(() => {
    setSelectedCustomerId(customers[0]?.id ?? "");
  }, [customers]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) =>
      selectedCustomerId ? p.customerId === selectedCustomerId : true
    );
  }, [projects, selectedCustomerId]);

  useEffect(() => {
    const first = filteredProjects[0]?.id ?? "";
    setSelectedProjectId((prev) =>
      prev && filteredProjects.some((p) => p.id === prev) ? prev : first
    );
  }, [filteredProjects]);

  async function reload() {
    if (!selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getProjectManagerTimeEntries({
        projectId: selectedProjectId,
        year,
        month,
      });
      setEntries(res.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }

  const allInvoiced = entries.length > 0 && entries.every((e) => e.invoicedAt != null);
  const someEntries = entries.length > 0;

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, year, month]);

  const projectOptions = useMemo(() => {
    return filteredProjects.map((p) => ({
      value: p.id,
      label: p.name,
    }));
  }, [filteredProjects]);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: c.name })),
    [customers]
  );

  const monthLabel = getMonthLabel(month, year);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  type SortKey =
    | "entryDate"
    | "consultantName"
    | "jira"
    | "task"
    | "internalComment"
    | "reportedHours"
    | "pmHours"
    | "pmComment"
    | "status";
  type SortDir = "asc" | "desc";

  const [sortKey, setSortKey] = useState<SortKey>("entryDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedEntries = useMemo(() => {
    const getEffectivePmHours = (e: ProjectManagerEntry) =>
      e.pmEditedHours ?? null;
    const isInvoiced = (e: ProjectManagerEntry) => e.invoicedAt != null;

    const baseCompare = (a: ProjectManagerEntry, b: ProjectManagerEntry) => {
      let res = 0;
      switch (sortKey) {
        case "entryDate":
          res = a.entryDate.localeCompare(b.entryDate);
          break;
        case "consultantName":
          res = a.consultantName.localeCompare(b.consultantName);
          break;
        case "task":
          res = (a.task ?? "").localeCompare(b.task ?? "");
          break;
        case "jira":
          res = [a.jiraKey ?? "", a.jiraTitle ?? ""]
            .join(" ")
            .localeCompare([b.jiraKey ?? "", b.jiraTitle ?? ""].join(" "));
          break;
        case "internalComment":
          res = (a.comment ?? "").localeCompare(b.comment ?? "");
          break;
        case "pmComment":
          res = (a.pmEditedComment ?? "").localeCompare(b.pmEditedComment ?? "");
          break;
        case "reportedHours":
          res = a.hours - b.hours;
          break;
        case "pmHours": {
          // Keep unedited entries (pmEditedHours === null) grouped at the end when sorting desc.
          const aPm = a.pmEditedHours ?? -1;
          const bPm = b.pmEditedHours ?? -1;
          res = aPm - bPm;
          break;
        }
        case "status":
          res = Number(isInvoiced(a)) - Number(isInvoiced(b));
          break;
        default:
          res = 0;
      }
      return sortDir === "asc" ? res : -res;
    };

    return [...entries].sort(baseCompare);
  }, [entries, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // Default directions: newest/ready/highest first.
    setSortDir(
      key === "consultantName" ||
        key === "task" ||
        key === "jira" ||
        key === "internalComment" ||
        key === "pmComment"
        ? "asc"
        : "desc"
    );
  };

  const goPrevMonth = () => {
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const goNextMonth = () => {
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const closeInlineEdit = () => {
    setEditingEntryId(null);
    setEditingField(null);
    setEditHoursStr("");
    setEditCommentStr("");
    setInlineEditStatus("idle");
    setInlineError(null);
  };

  const startInlineEdit = (entry: ProjectManagerEntry, field: InlineField) => {
    const isInvoiced = entry.invoicedAt != null;
    const canEditEntry = canEdit && (isAdmin || !isInvoiced);
    if (!canEditEntry) return;

    setEditingEntryId(entry.id);
    setEditingField(field);
    setInlineEditStatus("idle");
    setInlineError(null);

    if (field === "pmHours") {
      // Empty pmEditedHours should start as empty string so PM can clear the value.
      setEditHoursStr(entry.pmEditedHours != null ? String(entry.pmEditedHours) : "");
    } else {
      setEditCommentStr(entry.pmEditedComment ?? "");
    }
  };

  const commitInlineEdit = async () => {
    if (!editingEntryId || !editingField) return;
    if (inlineEditStatus === "saving") return;

    const entry = entries.find((e) => e.id === editingEntryId);
    if (!entry) {
      closeInlineEdit();
      return;
    }

    const isInvoiced = entry.invoicedAt != null;
    const canEditEntry = canEdit && (isAdmin || !isInvoiced);
    if (!canEditEntry) {
      closeInlineEdit();
      return;
    }

    setInlineEditStatus("saving");
    setInlineError(null);

    let pmHours: number | null | undefined;
    if (editingField === "pmHours") {
      const trimmed = editHoursStr.trim().replace(",", ".");
      if (trimmed === "") {
        pmHours = null; // Clear pm_edited_hours
      } else {
        const parsed = parseFloat(trimmed);
        if (Number.isNaN(parsed) || parsed < 0) {
          // PM hours has no inline error message; invalid value is ignored.
          closeInlineEdit();
          return;
        }
        pmHours = parsed;
      }
    }

    const pmComment =
      editingField === "pmComment" ? editCommentStr : String(entry.pmEditedComment ?? "");
    const pmHoursForSave = editingField === "pmHours" ? pmHours : undefined;

    try {
      const res = await pmUpdateTimeEntry({
        entryId: entry.id,
        pmHours: pmHoursForSave,
        pmComment,
        markInvoicing: false,
      });
      if (!res.ok) throw new Error(res.error ?? "Failed to update entry");

      lastSavedFieldRef.current = editingField;
      lastSavedEntryIdRef.current = entry.id;
      setShowSaved(true);
      closeInlineEdit();
      await reload();
      window.setTimeout(() => {
        setShowSaved(false);
        setInlineEditStatus("idle");
      }, SAVED_DURATION_MS);
    } catch (e) {
      setInlineEditStatus("error");
      setInlineError(e instanceof Error ? e.message : "Failed to save entry");
    }
  };

  const toggleInvoicing = async (entry: ProjectManagerEntry) => {
    if (!isAdmin) return;

    const ready = entry.invoicedAt == null;
    setLoading(true);
    setError(null);
    try {
      const res = await pmSetInvoicingStatus({
        entryId: entry.id,
        ready,
      });
      if (!res.ok) throw new Error(res.error ?? "Failed to update invoicing status");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update invoicing status");
    } finally {
      setLoading(false);
    }
  };

  const toggleAllInvoicing = async () => {
    if (!isAdmin) return;
    if (!entries.length) return;

    const ready = !allInvoiced;
    setLoading(true);
    setError(null);
    try {
      const res = await pmSetInvoicingStatusBulk({
        entryIds: entries.map((e) => e.id),
        ready,
      });
      if (!res.ok) throw new Error(res.error ?? "Failed to update invoicing status");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update invoicing status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        {/* Month selector ABOVE */}
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center justify-start gap-2">
            <button
              type="button"
              className="rounded p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
              onClick={goPrevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-left text-sm font-medium text-text-primary">
              {monthLabel}
            </span>
            <button
              type="button"
              className="rounded p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
              onClick={goNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center justify-start gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const isSelected = year === currentYear && month === m;
                const isCurrentMonth = year === currentYear && m === currentMonth;
                return (
                  <button
                    key={`${year}-${m}`}
                    type="button"
                    onClick={() => setMonth(m)}
                    className={`w-[4.0rem] cursor-pointer shrink-0 rounded-md px-2 py-1 text-center text-xs font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? "bg-brand-signal text-white"
                        : "bg-bg-muted text-text-secondary hover:bg-bg-muted/80 hover:text-text-primary"
                    } ${
                      !isSelected && isCurrentMonth
                        ? "ring-2 ring-brand-signal ring-offset-1 ring-offset-bg-default"
                        : ""
                    }`}
                    aria-label={`Month ${m}`}
                    aria-pressed={isSelected}
                    title={isCurrentMonth ? "Current month" : undefined}
                  >
                    {TIME_REPORT_MONTH_NAMES[m - 1]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Customer/Project selects BELOW (smaller) */}
        <div className="flex flex-wrap items-start gap-3 justify-start">
          <div className="w-full sm:w-[160px] lg:w-[180px]">
            <Select
              id="pm-time-report-customer-select"
              value={selectedCustomerId}
              onValueChange={setSelectedCustomerId}
              options={customerOptions}
              placeholder="Select customer"
              size="sm"
              variant="filter"
              className="w-full min-w-0"
              triggerClassName="h-9"
            />
          </div>
          <div className="w-full sm:w-[160px] lg:w-[180px]">
            <Select
              id="pm-time-report-project-select"
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              options={projectOptions}
              placeholder="Select project"
              size="sm"
              variant="filter"
              className="w-full min-w-0"
              triggerClassName="h-9"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border-subtle bg-bg-default p-3">
        {loading && entries.length === 0 ? (
          <div className="py-8 text-sm text-text-secondary">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-sm text-text-secondary">No reported time entries.</div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-hidden">
              <table className="w-full table-fixed border-collapse text-[10px]">
                <colgroup>
                  <col className="w-[55px]" />
                  <col className="w-[95px]" />
                  <col className="w-[115px]" />
                  <col className="w-[135px]" />
                  <col className="w-[90px]" />
                  <col className="w-[40px]" />
                  <col className="w-[55px]" />
                  <col className="w-[90px]" />
                  <col className="w-[40px]" />
                </colgroup>
                <thead className="bg-bg-muted/40">
                  <tr className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    <th className="border border-border-subtle px-2 py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("entryDate")}
                        className={`flex h-full w-full items-center justify-start hover:text-text-primary ${
                          sortKey === "entryDate" ? "text-text-primary underline" : ""
                        }`}
                      >
                        Date
                      </button>
                    </th>
                    <th className="border border-border-subtle px-2 py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("consultantName")}
                        className={`flex h-full w-full items-center justify-start hover:text-text-primary ${
                          sortKey === "consultantName" ? "text-text-primary underline" : ""
                        }`}
                      >
                        Consultant
                      </button>
                    </th>
                    <th className="border border-border-subtle px-2 py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("jira")}
                        className={`flex h-full w-full items-center justify-start hover:text-text-primary ${
                          sortKey === "jira" ? "text-text-primary underline" : ""
                        }`}
                      >
                        Jira
                      </button>
                    </th>
                    <th className="border border-border-subtle px-2 py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("task")}
                        className={`flex h-full w-full items-center justify-start hover:text-text-primary ${
                          sortKey === "task" ? "text-text-primary underline" : ""
                        }`}
                      >
                        Task
                      </button>
                    </th>
                    <th className="border border-border-subtle px-2 py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("internalComment")}
                        className={`flex h-full w-full items-center justify-start hover:text-text-primary ${
                          sortKey === "internalComment" ? "text-text-primary underline" : ""
                        }`}
                      >
                        Internal
                      </button>
                    </th>
                    <th className="border border-border-subtle px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("reportedHours")}
                        className={`flex h-full w-full items-center justify-end hover:text-text-primary ${
                          sortKey === "reportedHours" ? "text-text-primary underline" : ""
                        }`}
                      >
                        Hrs
                      </button>
                    </th>
                    <th className="border border-border-subtle px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("pmHours")}
                        className={`flex h-full w-full items-center justify-end hover:text-text-primary ${
                          sortKey === "pmHours" ? "text-text-primary underline" : ""
                        }`}
                      >
                        PM hrs
                      </button>
                    </th>
                    <th className="border border-border-subtle px-2 py-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => toggleSort("pmComment")}
                        className={`flex h-full w-full items-center justify-start hover:text-text-primary ${
                          sortKey === "pmComment" ? "text-text-primary underline" : ""
                        }`}
                      >
                        PM comment
                      </button>
                    </th>
                    <th className="border border-border-subtle px-1 py-1.5">
                      <div className="flex flex-col items-center gap-1">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => toggleAllInvoicing()}
                            disabled={!entries.length || loading}
                            aria-label={allInvoiced ? "Unmark all invoicing" : "Mark all invoicing"}
                            title={allInvoiced ? "Unmark all invoicing" : "Mark all invoicing"}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle transition-colors ${
                              allInvoiced
                                ? "bg-success/10 text-success border-success/40"
                                : "bg-bg-muted/40 text-text-muted hover:bg-bg-muted/60"
                            }`}
                          >
                            {allInvoiced ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                          </button>
                        ) : (
                          <div className="h-6 w-6" aria-hidden />
                        )}
                        <button
                          type="button"
                          onClick={() => toggleSort("status")}
                          className={`flex h-full w-full items-center justify-center hover:text-text-primary ${
                            sortKey === "status" ? "text-text-primary underline" : ""
                          }`}
                        >
                          Inv.
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((e) => {
                    const isInvoiced = e.invoicedAt != null;
                    const canEditEntry = canEdit && (isAdmin || !isInvoiced);
                    const reportedHours = e.hours;
                    const pmHoursValue = e.pmEditedHours ?? null;
                    const pmComment = e.pmEditedComment ?? "";
                    const internalComment = e.comment ?? "";

                    return (
                      <tr key={e.id} className="align-top">
                        <td className="border border-border-subtle px-2 py-2 !text-[10px] text-text-secondary">{e.entryDate}</td>
                        <td className="border border-border-subtle px-2 py-2 !text-[10px]">
                          <div className="truncate">{e.consultantName}</div>
                        </td>
                        <td className="border border-border-subtle px-2 py-2 !text-[10px]">
                          {e.jiraKey ? (
                            <>
                              <div className="truncate font-medium">{e.jiraKey}</div>
                              {e.jiraTitle ? (
                                <div className="truncate !text-[10px] text-text-muted">{e.jiraTitle}</div>
                              ) : null}
                            </>
                          ) : (
                            <div className="!text-[10px] text-text-primary opacity-60">—</div>
                          )}
                        </td>
                        <td className="border border-border-subtle px-2 py-2 !text-[10px]">
                          <div className="truncate font-medium">{e.task || "—"}</div>
                        </td>
                        <td className="border border-border-subtle px-2 py-2 !text-[10px]">
                          {internalComment ? (
                            <div className="line-clamp-2 text-text-muted !text-[10px]">{internalComment}</div>
                          ) : (
                            <div className="!text-[10px] text-text-primary opacity-60">—</div>
                          )}
                        </td>
                        <td className="border border-border-subtle px-2 py-2 !text-[10px] text-right text-text-primary font-semibold tabular-nums">
                          {reportedHours.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="border border-border-subtle px-2 py-2 !text-[10px] text-right align-top">
                          {editingEntryId === e.id && editingField === "pmHours" ? (
                            <input
                              type="text"
                              value={editHoursStr}
                              onChange={(ev) => setEditHoursStr(ev.target.value)}
                              onFocus={(ev) => ev.target.select()}
                              onBlur={commitInlineEdit}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") {
                                  ev.preventDefault();
                                  commitInlineEdit();
                                }
                                if (ev.key === "Escape") {
                                  ev.preventDefault();
                                  closeInlineEdit();
                                }
                              }}
                              className={`${editInputClass} text-right !text-[10px]`}
                              placeholder="0"
                              inputMode="decimal"
                              autoFocus
                            />
                          ) : canEditEntry ? (
                            <button
                              type="button"
                              aria-label="Edit PM hours"
                              onClick={() => startInlineEdit(e, "pmHours")}
                              className="group flex w-full min-w-0 cursor-pointer items-center justify-end rounded-md border border-transparent px-2 py-1 text-right transition-colors hover:bg-bg-muted/50 hover:border-form focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset"
                            >
                              <span className="min-w-0 flex-1 overflow-hidden truncate whitespace-nowrap text-right !text-[10px] font-semibold text-text-primary tabular-nums">
                                {pmHoursValue != null
                                  ? pmHoursValue.toLocaleString("en-US", { maximumFractionDigits: 2 })
                                  : "—"}
                              </span>
                            </button>
                          ) : (
                            <FieldValue className="!text-[10px] !text-right tabular-nums">
                              {pmHoursValue != null
                                ? pmHoursValue.toLocaleString("en-US", { maximumFractionDigits: 2 })
                                : "—"}
                            </FieldValue>
                          )}
                        </td>
                        <td className="border border-border-subtle px-2 py-2 !text-[10px]">
                          <InlineEditFieldContainer
                            isEditing={editingEntryId === e.id && editingField === "pmComment"}
                            onRequestClose={commitInlineEdit}
                            showSavedIndicator={
                              showSaved &&
                              lastSavedEntryIdRef.current === e.id &&
                              lastSavedFieldRef.current === "pmComment"
                            }
                            displayContent={
                              canEditEntry ? (
                                <InlineEditTrigger onClick={() => startInlineEdit(e, "pmComment")}>
                                  <div className="min-w-0">
                                    <span className="line-clamp-2 !text-[10px] font-semibold text-text-primary">
                                      {pmComment || "—"}
                                    </span>
                                  </div>
                                </InlineEditTrigger>
                              ) : (
                                <span className="line-clamp-2 !text-[10px] font-semibold text-text-primary">
                                  {pmComment || "—"}
                                </span>
                              )
                            }
                            editContent={
                              <textarea
                                rows={3}
                                value={editCommentStr}
                                onChange={(ev) => setEditCommentStr(ev.target.value)}
                                onBlur={commitInlineEdit}
                                onKeyDown={(ev) => {
                                  if (ev.key === "Escape") {
                                    ev.preventDefault();
                                    closeInlineEdit();
                                  }
                                }}
                                className={`${editInputClass} resize-none !text-[10px]`}
                                placeholder="Add comment (optional)"
                                autoFocus
                              />
                            }
                            statusContent={
                              <InlineEditStatus status={inlineEditStatus} message={inlineError} />
                            }
                          />
                        </td>
                        <td className="border border-border-subtle px-1 py-2 !text-[10px] text-center">
                          <button
                            type="button"
                            aria-label={isInvoiced ? "Turn off invoicing" : "Turn on invoicing"}
                            title={isInvoiced ? "Ready for invoicing" : "Not ready for invoicing"}
                            onClick={() => toggleInvoicing(e)}
                            disabled={!isAdmin}
                            className={`mx-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle transition-colors ${
                              isInvoiced
                                ? "bg-success/10 text-success border-success/40"
                                : "bg-bg-muted/40 text-text-muted"
                            } ${!isAdmin ? "opacity-40 cursor-not-allowed" : "hover:bg-bg-muted/60"}`}
                          >
                            {isInvoiced ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

