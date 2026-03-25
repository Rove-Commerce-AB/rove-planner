"use client";

import { Fragment, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronLeft, Percent, ExternalLink } from "lucide-react";
import type { AllocationPageData } from "@/lib/allocationPageTypes";

export type EditingCellCustomerProject = {
  customerId: string;
  consultantId: string;
  roleId: string | null;
  weekIndex: number;
  week: number;
  year: number;
  allocationId: string | null;
  otherAllocationIds: string[];
  projectId: string;
  currentHours: number;
};

export type EditingCellConsultant = {
  consultantId: string;
  projectId: string;
  roleId: string | null;
  weekIndex: number;
  week: number;
  year: number;
  allocationId: string | null;
  currentHours: number;
};

export type AddInitialParams = {
  consultantId?: string;
  consultantName?: string;
  week?: number;
  weekFrom?: number;
  weekTo?: number;
  year: number;
  projectId?: string;
  projectLabel?: string;
};

export type AllocationCustomerProjectTabsProps = {
  tab: "customer" | "project";
  data: AllocationPageData;
  year: number;
  weekFrom: number;
  weekTo: number;
  monthSpans: { colSpan: number; label: string }[];
  isCurrentWeek: (w: { year: number; week: number }) => boolean;
  renderWeekHeaderCells: (tableKey: string, borderClass?: string) => React.ReactNode;
  goToPreviousWeeks: () => void;
  goToNextWeeks: () => void;
  getPreviousUrl: () => string;
  getNextUrl: () => string;
  router: { prefetch: (url: string) => void };
  expandedCustomers: Set<string>;
  toggleCustomer: (id: string) => void;
  perCustomer: unknown[];
  expandedProjects: Set<string>;
  toggleProject: (id: string) => void;
  perProject: unknown[];
  editingCell: EditingCellCustomerProject | null;
  setEditingCell: Dispatch<SetStateAction<EditingCellCustomerProject | null>>;
  editingCellValue: string;
  setEditingCellValue: Dispatch<SetStateAction<string>>;
  handleCellInputBlur: () => void;
  handleCellInputKeyDown: (e: React.KeyboardEvent) => void;
  savingCell: boolean;
  cellError: string | null;
  setAddModalOpen: Dispatch<SetStateAction<boolean>>;
  setAddInitialParams: Dispatch<SetStateAction<AddInitialParams | null>>;
  editingCellConsultant: EditingCellConsultant | null;
  setEditingCellConsultant: Dispatch<SetStateAction<EditingCellConsultant | null>>;
  editingCellConsultantValue: string;
  setEditingCellConsultantValue: Dispatch<SetStateAction<string>>;
  saveCellHoursConsultant: (cell: EditingCellConsultant, value: string) => Promise<void>;
  handleCellConsultantInputBlur: () => void;
  handleCellConsultantInputKeyDown: (e: React.KeyboardEvent) => void;
  savingCellConsultant: boolean;
  formatWeekLabel: (week: number, year: number) => string;
};

const weekNav = (p: AllocationCustomerProjectTabsProps) => (
  <div className="mb-2 flex items-center justify-end gap-2 px-1">
    <span className="text-[10px] tabular-nums text-text-primary opacity-70">
      {p.weekFrom <= p.weekTo
        ? `${p.year} · v${p.weekFrom}–v${p.weekTo}`
        : `${p.year} v${p.weekFrom} – ${p.year + 1} v${p.weekTo}`}
    </span>
    <button
      type="button"
      onClick={p.goToPreviousWeeks}
      onMouseEnter={() => p.router.prefetch(p.getPreviousUrl())}
      className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
      aria-label="Previous weeks"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
    </button>
    <button
      type="button"
      onClick={p.goToNextWeeks}
      onMouseEnter={() => p.router.prefetch(p.getNextUrl())}
      className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
      aria-label="Next weeks"
    >
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  </div>
);

export function AllocationCustomerProjectTabs(props: AllocationCustomerProjectTabsProps) {
  const p = props;
  const { data, tab } = p;
  const [customerDragState, setCustomerDragState] = useState<{
    mode: "consultant" | "project";
    customerId: string;
    customerName: string;
    projectId: string;
    projectName: string;
    consultantId?: string;
    consultantName?: string;
    roleId?: string | null;
    weekIndexStart: number;
    weekIndexEnd: number;
    startWeek: number;
    startYear: number;
    startTotalHours?: number;
    startAllocationId?: string | null;
    startOtherAllocationIds?: string[];
    startProjectId?: string;
  } | null>(null);
  const [customerDragMoved, setCustomerDragMoved] = useState(false);
  const [preventNextConsultantCellClick, setPreventNextConsultantCellClick] = useState(false);

  useEffect(() => {
    if (tab !== "customer" || customerDragState === null) return;
    const onMouseUp = () => {
      const drag = customerDragState;
      const lo = Math.min(drag.weekIndexStart, drag.weekIndexEnd);
      const hi = Math.max(drag.weekIndexStart, drag.weekIndexEnd);
      const wFrom = data.weeks[lo];
      const wTo = data.weeks[hi];
      if (!wFrom || !wTo) {
        setCustomerDragState(null);
        setCustomerDragMoved(false);
        return;
      }

      if (drag.mode === "consultant" && !customerDragMoved && lo === hi) {
        p.setEditingCell({
          customerId: drag.customerId,
          consultantId: drag.consultantId ?? "",
          roleId: drag.roleId ?? null,
          weekIndex: lo,
          week: drag.startWeek,
          year: drag.startYear,
          allocationId: drag.startAllocationId ?? null,
          otherAllocationIds: drag.startOtherAllocationIds ?? [],
          projectId: drag.startProjectId ?? drag.projectId,
          currentHours: drag.startTotalHours ?? 0,
        });
        p.setEditingCellValue(String(drag.startTotalHours ?? 0));
      } else if (drag.mode === "consultant") {
        p.setAddInitialParams({
          consultantId: drag.consultantId,
          consultantName: drag.consultantName,
          year: wFrom.year,
          weekFrom: wFrom.week,
          weekTo: wTo.week,
          projectId: drag.projectId,
          projectLabel: `${drag.customerName} - ${drag.projectName}`,
        });
        p.setAddModalOpen(true);
        setPreventNextConsultantCellClick(true);
      } else {
        p.setAddInitialParams({
          year: wFrom.year,
          weekFrom: wFrom.week,
          weekTo: wTo.week,
          projectId: drag.projectId,
          projectLabel: `${drag.customerName} - ${drag.projectName}`,
        });
        p.setAddModalOpen(true);
      }

      setCustomerDragState(null);
      setCustomerDragMoved(false);
    };

    document.addEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [tab, customerDragState, customerDragMoved, data.weeks, p]);

  if (tab === "customer") {
    return (
      <div className="p-2">
        {weekNav(p)}
        <table className="w-full min-w-0 table-fixed border border-form text-[10px]">
          <colgroup>
            <col style={{ width: 300 }} />
            {data.weeks.map((w) => (
              <col key={`${w.year}-${w.week}`} className="w-[29px]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-grid-subtle">
              <th
                rowSpan={2}
                style={{ width: 300, maxWidth: 300, boxSizing: "border-box" }}
                className="border-r border-grid-subtle px-2 py-1 text-left font-medium text-text-primary opacity-80"
              >
                Customer / Consultant
              </th>
              {p.monthSpans.map((span, i) => (
                <th
                  key={i}
                  colSpan={span.colSpan}
                  className="border-r border-grid px-0.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-primary opacity-60"
                >
                  {span.label}
                </th>
              ))}
            </tr>
            <tr className="border-b border-grid-subtle">
              {p.renderWeekHeaderCells("customer", "border-grid")}
            </tr>
          </thead>
          <tbody>
            {(p.perCustomer as Array<{
              customer: { id: string; name: string };
              projectGroups: Array<{
                project: { id: string; name: string };
                consultantRows: Array<{
                  consultantId: string;
                  consultantName: string;
                  roleId: string | null;
                  roleName: string;
                  weeks: {
                    week: number;
                    cells: {
                      id: string;
                      hours: number;
                      displayHours: number;
                      isHidden: boolean;
                      projectId: string;
                    }[];
                  }[];
                  unavailableByWeek: boolean[];
                }>;
                totalByWeek: Map<string, number>;
              }>;
              totalByWeek: Map<string, number>;
            }>).map((row) => {
              const expanded = p.expandedCustomers.has(row.customer.id);
              const hasProjects = row.projectGroups.length > 0;
              return (
                <Fragment key={row.customer.id}>
                  <tr className={`border-b border-grid-light-subtle last:border-form ${expanded && hasProjects ? "shadow-[0_2px_8px_rgba(0,0,0,0.28)]" : ""}`}>
                    <td className="border-r border-grid-light-subtle px-2 py-1.5 align-top">
                      <div className="flex items-center justify-between gap-1 w-full">
                        <button
                          type="button"
                          onClick={() => hasProjects && p.toggleCustomer(row.customer.id)}
                          className="flex min-w-0 flex-1 items-center gap-1 text-left whitespace-nowrap"
                        >
                          {hasProjects ? (
                            expanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className="font-medium text-text-primary">{row.customer.name}</span>
                        </button>
                        <Link
                          href={`/customers/${row.customer.id}`}
                          className="shrink-0 rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
                          aria-label={`Open ${row.customer.name}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                    {data.weeks.map((w, i) => {
                      const total = row.totalByWeek.get(`${w.year}-${w.week}`) ?? 0;
                      const hasBooking = total > 0;
                      const prev = data.weeks[i - 1];
                      const prevTotal = i > 0 && prev ? row.totalByWeek.get(`${prev.year}-${prev.week}`) ?? 0 : 0;
                      const showLeftBorder = hasBooking && (i === 0 || prevTotal === 0);
                      return (
                        <td
                          key={`${w.year}-${w.week}`}
                          className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center text-[9px] tabular-nums text-text-primary ${p.isCurrentWeek(data.weeks[i]) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""}`}
                        >
                          {hasBooking ? `${total}h` : null}
                        </td>
                      );
                    })}
                  </tr>
                  {expanded &&
                    row.projectGroups.map((pg) => (
                      <Fragment key={pg.project.id}>
                        <tr className="border-b border-grid-light-subtle bg-bg-muted/30">
                          <td className="border-r border-grid-light-subtle px-2 py-1 pl-8 text-text-primary">
                            <span className="flex items-center gap-1 whitespace-nowrap font-medium text-text-primary">
                              {pg.project.name}
                            </span>
                          </td>
                          {data.weeks.map((w, i) => {
                            const total = pg.totalByWeek.get(`${w.year}-${w.week}`) ?? 0;
                            const hasBooking = total > 0;
                            const prev = data.weeks[i - 1];
                            const prevTotal =
                              i > 0 && prev
                                ? pg.totalByWeek.get(`${prev.year}-${prev.week}`) ?? 0
                                : 0;
                            const showLeftBorder =
                              hasBooking && (i === 0 || prevTotal === 0);
                            const isProjectDragRange =
                              customerDragState?.mode === "project" &&
                              customerDragState.customerId === row.customer.id &&
                              customerDragState.projectId === pg.project.id &&
                              i >=
                                Math.min(
                                  customerDragState.weekIndexStart,
                                  customerDragState.weekIndexEnd
                                ) &&
                              i <=
                                Math.max(
                                  customerDragState.weekIndexStart,
                                  customerDragState.weekIndexEnd
                                );
                            const dragMin =
                              customerDragState?.mode === "project"
                                ? Math.min(
                                    customerDragState.weekIndexStart,
                                    customerDragState.weekIndexEnd
                                  )
                                : -1;
                            const dragMax =
                              customerDragState?.mode === "project"
                                ? Math.max(
                                    customerDragState.weekIndexStart,
                                    customerDragState.weekIndexEnd
                                  )
                                : -1;
                            const isDragLeft = isProjectDragRange && i === dragMin;
                            const isDragRight = isProjectDragRange && i === dragMax;
                            return (
                              <td
                                key={`${w.year}-${w.week}`}
                                className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} cursor-crosshair select-none px-1 py-1 text-center text-[9px] tabular-nums text-text-primary hover:bg-brand-blue/50 ${p.isCurrentWeek(data.weeks[i]) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isProjectDragRange ? "drag-range-cell border-t border-b border-brand-signal bg-brand-signal/20" : ""} ${isDragLeft ? "border-l" : ""} ${isDragRight ? "border-r" : ""}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setCustomerDragState({
                                    mode: "project",
                                    customerId: row.customer.id,
                                    customerName: row.customer.name,
                                    projectId: pg.project.id,
                                    projectName: pg.project.name,
                                    weekIndexStart: i,
                                    weekIndexEnd: i,
                                    startWeek: w.week,
                                    startYear: w.year,
                                  });
                                  setCustomerDragMoved(false);
                                }}
                                onMouseEnter={() => {
                                  if (
                                    customerDragState?.mode === "project" &&
                                    customerDragState.customerId === row.customer.id &&
                                    customerDragState.projectId === pg.project.id
                                  ) {
                                    setCustomerDragState((prev) =>
                                      prev ? { ...prev, weekIndexEnd: i } : null
                                    );
                                    setCustomerDragMoved(true);
                                  }
                                }}
                              >
                                {hasBooking ? `${total}h` : null}
                              </td>
                            );
                          })}
                        </tr>
                        {pg.consultantRows.map((cr) => (
                      <tr
                        key={`${pg.project.id}-${cr.consultantId}-${cr.roleId ?? "none"}`}
                        className="border-b border-grid-light-subtle last:border-form"
                      >
                        <td className="border-r border-grid-light-subtle px-2 py-1 pl-14 text-text-primary">
                          <span className="flex items-center gap-1 whitespace-nowrap text-text-primary">
                            {cr.consultantName}
                            {cr.roleName ? (
                              <span className="opacity-80"> · {cr.roleName}</span>
                            ) : null}
                          </span>
                        </td>
                        {cr.weeks.map((w, i) => {
                          const cells = w.cells;
                          const totalHours = cells.reduce((s, x) => s + x.hours, 0);
                          const displayTotal = cells.reduce((s, x) => s + (x.isHidden ? 0 : x.displayHours), 0);
                          const hasBooking = totalHours > 0;
                          const prevHours = i > 0 ? cr.weeks[i - 1].cells.reduce((s, x) => s + (x.isHidden ? 0 : x.displayHours), 0) : 0;
                          const showLeftBorder = hasBooking && (i === 0 || prevHours === 0);
                          const weekInfo = data.weeks[i];
                          const firstProjectForCustomer = data.projects.find((pr) => pr.customer_id === row.customer.id);
                          const editingCell = p.editingCell as { customerId: string; consultantId: string; roleId: string | null; weekIndex: number } | null;
                          const isEditing =
                            editingCell?.customerId === row.customer.id &&
                            editingCell?.consultantId === cr.consultantId &&
                            editingCell?.roleId === cr.roleId &&
                            editingCell?.weekIndex === i;
                          return (
                            <td
                              key={`${weekInfo.year}-${weekInfo.week}`}
                              className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} p-0 py-1 text-center text-[9px] tabular-nums cursor-crosshair select-none ${cr.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${p.isCurrentWeek(weekInfo) && !cr.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${p.isCurrentWeek(weekInfo) && cr.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${isEditing ? "align-middle" : ""} ${customerDragState?.mode === "consultant" && customerDragState.customerId === row.customer.id && customerDragState.projectId === pg.project.id && customerDragState.consultantId === cr.consultantId && i >= Math.min(customerDragState.weekIndexStart, customerDragState.weekIndexEnd) && i <= Math.max(customerDragState.weekIndexStart, customerDragState.weekIndexEnd) ? "drag-range-cell border-t border-b border-brand-signal bg-brand-signal/20" : ""}`}
                              onMouseDown={(e) => {
                                if (isEditing) return;
                                e.preventDefault();
                                setCustomerDragState({
                                  mode: "consultant",
                                  customerId: row.customer.id,
                                  customerName: row.customer.name,
                                  projectId: pg.project.id,
                                  projectName: pg.project.name,
                                  consultantId: cr.consultantId,
                                  consultantName: cr.consultantName,
                                  roleId: cr.roleId,
                                  weekIndexStart: i,
                                  weekIndexEnd: i,
                                  startWeek: w.week,
                                  startYear: weekInfo.year,
                                  startTotalHours: totalHours,
                                  startAllocationId: cells[0]?.id ?? null,
                                  startOtherAllocationIds: cells.slice(1).map((c) => c.id),
                                  startProjectId:
                                    cells[0]?.projectId ??
                                    pg.project.id ??
                                    firstProjectForCustomer?.id ??
                                    "",
                                });
                                setCustomerDragMoved(false);
                              }}
                              onMouseEnter={() => {
                                if (
                                  customerDragState?.mode === "consultant" &&
                                  customerDragState.customerId === row.customer.id &&
                                  customerDragState.projectId === pg.project.id &&
                                  customerDragState.consultantId === cr.consultantId
                                ) {
                                  setCustomerDragState((prev) =>
                                    prev ? { ...prev, weekIndexEnd: i } : null
                                  );
                                  setCustomerDragMoved(true);
                                }
                              }}
                            >
                              {isEditing ? (
                                <div className="flex flex-col min-w-0">
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={p.editingCellValue}
                                    onChange={(e) => p.setEditingCellValue(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={p.handleCellInputBlur}
                                    onKeyDown={p.handleCellInputKeyDown}
                                    disabled={p.savingCell}
                                    className="w-full min-w-0 max-w-[3rem] min-h-[1.5rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[9px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal focus:ring-inset [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                  <div className="min-h-[0.75rem] shrink-0 text-[9px] leading-tight text-danger">
                                    {p.savingCell ? "Saving…" : p.cellError ?? "\u00A0"}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (preventNextConsultantCellClick) {
                                      setPreventNextConsultantCellClick(false);
                                      return;
                                    }
                                    p.setEditingCell({
                                      customerId: row.customer.id,
                                      consultantId: cr.consultantId,
                                      roleId: cr.roleId,
                                      weekIndex: i,
                                      week: w.week,
                                      year: weekInfo.year,
                                      allocationId: cells[0]?.id ?? null,
                                      otherAllocationIds: cells.slice(1).map((c) => c.id),
                                      projectId:
                                        cells[0]?.projectId ??
                                        pg.project.id ??
                                        firstProjectForCustomer?.id ??
                                        "",
                                      currentHours: totalHours,
                                    });
                                    p.setEditingCellValue(String(totalHours || ""));
                                  }}
                                  className="block w-full min-h-[1.5rem] cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-[9px] text-text-primary transition-colors hover:bg-bg-muted/50 hover:border-form focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-signal"
                                  tabIndex={0}
                                >
                                  {displayTotal > 0 ? `${displayTotal}h` : totalHours > 0 ? "—" : "\u00A0"}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                        ))}
                      </Fragment>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // tab === "project"
  const perProject = p.perProject as Array<{
    project: { id: string; customer_id: string; label: string; showProbabilitySymbol?: boolean };
    consultantRows: Array<{
      consultantId: string;
      consultantName: string;
      roleId: string | null;
      roleName: string;
      weeks: { week: number; cells: { id: string; hours: number; displayHours: number; isHidden: boolean }[] }[];
      unavailableByWeek: boolean[];
    }>;
    totalByWeek: Map<string, number>;
  }>;

  return (
    <div className="p-2">
      {weekNav(p)}
      <table className="w-full min-w-0 table-fixed border border-form text-[10px]">
        <colgroup>
          <col style={{ width: 300 }} />
          {data.weeks.map((w) => (
            <col key={`${w.year}-${w.week}`} className="w-[29px]" />
          ))}
          <col className="w-[4rem]" />
        </colgroup>
        <thead>
          <tr className="border-b border-grid-subtle">
            <th
              rowSpan={2}
              style={{ width: 300, maxWidth: 300, boxSizing: "border-box" }}
              className="border-r border-grid-subtle px-2 py-1 text-left font-medium text-text-primary opacity-80"
            >
              Project / Consultant
            </th>
            {p.monthSpans.map((span, i) => (
              <th
                key={i}
                colSpan={span.colSpan}
                className="border-r border-grid px-0.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-primary opacity-60"
              >
                {span.label}
              </th>
            ))}
            <th
              rowSpan={2}
              className="border-r border-grid px-1 py-1 text-center text-[10px] font-medium text-text-primary opacity-80"
            >
              Total
            </th>
          </tr>
          <tr className="border-b border-grid-subtle">
            {p.renderWeekHeaderCells("project", "border-grid")}
          </tr>
        </thead>
        <tbody>
          {perProject.map((row) => {
            const expanded = p.expandedProjects.has(row.project.id);
            const hasConsultants = row.consultantRows.length > 0;
            return (
              <Fragment key={row.project.id}>
                <tr className={`border-b border-grid-light-subtle last:border-form ${expanded && hasConsultants ? "shadow-[0_2px_8px_rgba(0,0,0,0.28)]" : ""}`}>
                  <td className="border-r border-grid-light-subtle px-2 py-1.5 align-top">
                    <div className="flex items-center justify-between gap-1 w-full">
                      <button
                        type="button"
                        onClick={() => hasConsultants && p.toggleProject(row.project.id)}
                        className="flex min-w-0 flex-1 items-center gap-1 text-left whitespace-nowrap"
                      >
                        {hasConsultants ? (
                          expanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <span className="flex items-center gap-1 font-medium text-text-primary">
                          {row.project.showProbabilitySymbol && (
                            <Percent
                              className="h-3 w-3 shrink-0 opacity-60"
                              aria-label="Probability under 100%"
                            />
                          )}
                          {row.project.label}
                        </span>
                      </button>
                      <Link
                        href={`/projects/${row.project.id}`}
                        className="shrink-0 rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
                        aria-label={`Open ${row.project.label}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                  {data.weeks.map((w, i) => {
                    const total = row.totalByWeek.get(`${w.year}-${w.week}`) ?? 0;
                    const hasBooking = total > 0;
                    const prev = data.weeks[i - 1];
                    const prevTotal = i > 0 && prev ? row.totalByWeek.get(`${prev.year}-${prev.week}`) ?? 0 : 0;
                    const showLeftBorder = hasBooking && (i === 0 || prevTotal === 0);
                    return (
                      <td
                        key={`${w.year}-${w.week}`}
                        className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center text-[9px] tabular-nums text-text-primary ${p.isCurrentWeek(data.weeks[i]) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""}`}
                      >
                        {hasBooking ? `${total}h` : null}
                      </td>
                    );
                  })}
                  <td className="border-r border-grid-light px-1 py-1 text-right text-[9px] font-medium tabular-nums text-text-primary">
                    {(() => {
                      const projectTotal = data.weeks.reduce(
                        (sum, w) => sum + (row.totalByWeek.get(`${w.year}-${w.week}`) ?? 0),
                        0
                      );
                      return projectTotal > 0 ? `${projectTotal}h` : null;
                    })()}
                  </td>
                </tr>
                {expanded &&
                  row.consultantRows.map((cr) => (
                    <tr
                      key={`${cr.consultantId}-${cr.roleId ?? "none"}`}
                      className="border-b border-grid-light-subtle last:border-form"
                    >
                      <td className="border-r border-grid-light-subtle px-2 py-1 pl-8 text-text-primary">
                        <span className="flex items-center gap-1 whitespace-nowrap text-text-primary">
                          {cr.consultantName}
                          {cr.roleName ? (
                            <span className="opacity-80"> · {cr.roleName}</span>
                          ) : null}
                        </span>
                      </td>
                      {cr.weeks.map((w, i) => {
                        const cells = w.cells;
                        const totalHours = cells.reduce((s, x) => s + x.hours, 0);
                        const displayTotal = cells.reduce((s, x) => s + (x.isHidden ? 0 : x.displayHours), 0);
                        const hasBooking = totalHours > 0;
                        const prevHours =
                          i > 0
                            ? cr.weeks[i - 1].cells.reduce((s, x) => s + (x.isHidden ? 0 : x.displayHours), 0)
                            : 0;
                        const showLeftBorder = hasBooking && (i === 0 || prevHours === 0);
                        const weekInfo = data.weeks[i];
                        const editingCell = p.editingCell as { projectId: string; consultantId: string; roleId: string | null; weekIndex: number } | null;
                        const isEditing =
                          editingCell?.projectId === row.project.id &&
                          editingCell?.consultantId === cr.consultantId &&
                          editingCell?.roleId === cr.roleId &&
                          editingCell?.weekIndex === i;
                        return (
                          <td
                            key={`${weekInfo.year}-${weekInfo.week}`}
                            className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} p-0 py-1 text-center text-[9px] tabular-nums ${cr.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${p.isCurrentWeek(weekInfo) && !cr.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${p.isCurrentWeek(weekInfo) && cr.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${isEditing ? "align-middle" : ""}`}
                          >
                            {isEditing ? (
                              <div className="flex flex-col min-w-0">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={p.editingCellValue}
                                  onChange={(e) => p.setEditingCellValue(e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  onBlur={p.handleCellInputBlur}
                                  onKeyDown={p.handleCellInputKeyDown}
                                  disabled={p.savingCell}
                                  className="w-full min-w-0 max-w-[3rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[9px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                                <div className="min-h-[0.75rem] shrink-0 text-[9px] leading-tight text-danger">
                                  {p.savingCell ? "Saving…" : p.cellError ?? "\u00A0"}
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  p.setEditingCell({
                                    customerId: row.project.customer_id,
                                    consultantId: cr.consultantId,
                                    roleId: cr.roleId,
                                    weekIndex: i,
                                    week: w.week,
                                    year: weekInfo.year,
                                    allocationId: cells[0]?.id ?? null,
                                    otherAllocationIds: cells.slice(1).map((c) => c.id),
                                    projectId: row.project.id,
                                    currentHours: totalHours,
                                  });
                                  p.setEditingCellValue(String(totalHours || ""));
                                }}
                                className="block w-full min-h-[1.5rem] cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-[9px] text-text-primary transition-colors hover:bg-bg-muted/50 hover:border-form focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-signal"
                                tabIndex={0}
                              >
                                {displayTotal > 0 ? `${displayTotal}h` : totalHours > 0 ? "—" : "\u00A0"}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-r border-grid-light px-1 py-1" aria-hidden />
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
