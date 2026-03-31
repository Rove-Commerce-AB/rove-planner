"use client";

import {
  Fragment,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import type { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Percent,
  ExternalLink,
} from "lucide-react";
import type { AllocationPageData } from "@/lib/allocationPageTypes";
import { TO_PLAN_CONSULTANT_ID } from "@/lib/allocationPageTypes";
import { allocationCellKey } from "@/lib/allocationCellKey";
import { formatAllocationEmbedRevenue } from "@/lib/allocationPageDisplay";
import { buildPerConsultantView } from "@/lib/allocationPageView";
import { getBookingAllocationsForRow } from "@/app/(app)/allocation/actions";

type PerConsultantRow = ReturnType<typeof buildPerConsultantView>[number];

type RouterCompat = Pick<ReturnType<typeof useRouter>, "push" | "prefetch">;

type DeleteBookingItem = { allocationId: string; year: number; week: number };

type DeleteBookingDialogState = {
  consultantId: string;
  consultantName: string;
  projectId: string;
  projectLabel: string;
  allocations: DeleteBookingItem[];
  selectedAllocationIds: Set<string>;
};

type ProjectRowDrag = {
  consultantId: string;
  projectId: string;
  roleId: string | null;
  consultantName: string;
  projectLabel: string;
  roleName?: string;
  weekIndexStart: number;
  weekIndexEnd: number;
};

type EditingCellConsultant = {
  consultantId: string;
  projectId: string;
  roleId: string | null;
  weekIndex: number;
  week: number;
  year: number;
  allocationId: string | null;
  currentHours: number;
};

type EmbedMode = {
  projectId: string;
  rates?: Record<string, number>;
  budgetHours?: number;
  budgetMoney?: number;
};

export type AllocationConsultantTablesProps = {
  expandableConsultantIds: Set<string>;
  setExpandedConsultants: Dispatch<SetStateAction<Set<string>>>;
  year: number;
  weekFrom: number;
  weekTo: number;
  goToPreviousWeeks: () => void;
  goToNextWeeks: () => void;
  embedWeekNavLoading: boolean;
  onWeekRangeChange?: (
    year: number,
    weekFrom: number,
    weekTo: number
  ) => void | Promise<void>;
  router: RouterCompat;
  getPreviousUrl: () => string;
  getNextUrl: () => string;
  embedMode: EmbedMode | undefined;
  data: AllocationPageData;
  monthSpans: { label: string; colSpan: number }[];
  renderWeekHeaderCells: (
    tableKey: string,
    borderClass?: string
  ) => ReactNode[];
  perConsultantDisplay: PerConsultantRow[];
  perConsultantInternal: PerConsultantRow[];
  perConsultantExternal: PerConsultantRow[];
  expandedConsultants: Set<string>;
  toggleConsultant: (id: string) => void;
  cellDragConsultant: { id: string; name: string } | null;
  setCellDragConsultant: Dispatch<
    SetStateAction<{ id: string; name: string } | null>
  >;
  cellDragWeekStart: number | null;
  setCellDragWeekStart: Dispatch<SetStateAction<number | null>>;
  cellDragWeekEnd: number | null;
  setCellDragWeekEnd: Dispatch<SetStateAction<number | null>>;
  getAllocationCellBgClassFn: (pct: number) => string;
  isCurrentWeek: (w: { year: number; week: number }) => boolean;
  editingCellConsultant: EditingCellConsultant | null;
  setEditingCellConsultant: Dispatch<
    SetStateAction<EditingCellConsultant | null>
  >;
  editingCellConsultantValue: string;
  setEditingCellConsultantValue: Dispatch<SetStateAction<string>>;
  handleCellConsultantInputBlur: () => void;
  handleCellConsultantInputKeyDown: (e: KeyboardEvent) => void;
  savingCellConsultant: boolean;
  optimisticCellHours: Record<string, number>;
  projectRowDrag: ProjectRowDrag | null;
  setProjectRowDrag: Dispatch<SetStateAction<ProjectRowDrag | null>>;
  setProjectRowDragMoved: Dispatch<SetStateAction<boolean>>;
  preventNextCellClickRef: MutableRefObject<boolean>;
  loadingDeleteBooking: boolean;
  setLoadingDeleteBooking: Dispatch<SetStateAction<boolean>>;
  setDeleteBookingDialog: Dispatch<
    SetStateAction<DeleteBookingDialogState | null>
  >;
  weekTotalsHours: number[];
  grandTotalHours: number;
  weekTotalsMoney: number[] | null;
  grandTotalMoney: number;
};

export function AllocationConsultantTables(props: AllocationConsultantTablesProps) {
  const allocationTableRenderStart = performance.now();

  const {
    expandableConsultantIds,
    setExpandedConsultants,
    year,
    weekFrom,
    weekTo,
    goToPreviousWeeks,
    goToNextWeeks,
    embedWeekNavLoading,
    onWeekRangeChange,
    router,
    getPreviousUrl,
    getNextUrl,
    embedMode,
    data,
    monthSpans,
    renderWeekHeaderCells,
    perConsultantDisplay,
    perConsultantInternal,
    perConsultantExternal,
    expandedConsultants,
    toggleConsultant,
    cellDragConsultant,
    setCellDragConsultant,
    cellDragWeekStart,
    setCellDragWeekStart,
    cellDragWeekEnd,
    setCellDragWeekEnd,
    getAllocationCellBgClassFn: getAllocationCellBgClass,
    isCurrentWeek,
    editingCellConsultant,
    setEditingCellConsultant,
    editingCellConsultantValue,
    setEditingCellConsultantValue,
    handleCellConsultantInputBlur,
    handleCellConsultantInputKeyDown,
    savingCellConsultant,
    optimisticCellHours,
    projectRowDrag,
    setProjectRowDrag,
    setProjectRowDragMoved,
    preventNextCellClickRef,
    loadingDeleteBooking,
    setLoadingDeleteBooking,
    setDeleteBookingDialog,
    weekTotalsHours,
    grandTotalHours,
    weekTotalsMoney,
    grandTotalMoney,
  } = props;

  // #region agent log
  fetch('http://127.0.0.1:7377/ingest/142286f1-190a-49b6-8e1e-854ceb792769',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97edeb'},body:JSON.stringify({sessionId:'97edeb',runId:'perf-scan-1',hypothesisId:'H2',location:'AllocationConsultantTables.tsx:189',message:'allocation table render timing',data:{ms:Math.round((performance.now()-allocationTableRenderStart)*100)/100,weeks:data.weeks.length,internalRows:perConsultantInternal.length,externalRows:perConsultantExternal.length,displayRows:perConsultantDisplay.length,expanded:expandedConsultants.size,embedMode:Boolean(embedMode)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return (
            <>
              <div className="p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2">
                    {expandableConsultantIds.size > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedConsultants(new Set(expandableConsultantIds))}
                          className="cursor-pointer text-xs text-text-primary opacity-70 hover:underline hover:opacity-100"
                        >
                          Expand all
                        </button>
                        <span className="text-xs text-text-primary opacity-50">|</span>
                        <button
                          type="button"
                          onClick={() => setExpandedConsultants(new Set())}
                          className="cursor-pointer text-xs text-text-primary opacity-70 hover:underline hover:opacity-100"
                        >
                          Collapse all
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums text-text-primary opacity-70">
                      {weekFrom <= weekTo
                        ? `${year} · v${weekFrom}–v${weekTo}`
                        : `${year} v${weekFrom} – ${year + 1} v${weekTo}`}
                    </span>
                    <button
                      type="button"
                      onClick={goToPreviousWeeks}
                      disabled={embedWeekNavLoading}
                      onMouseEnter={() => !onWeekRangeChange && router.prefetch(getPreviousUrl())}
                      className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100 disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Previous weeks"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextWeeks}
                      disabled={embedWeekNavLoading}
                      onMouseEnter={() => !onWeekRangeChange && router.prefetch(getNextUrl())}
                      className="rounded-sm p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100 disabled:opacity-50 disabled:pointer-events-none"
                      aria-label="Next weeks"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <table className="w-full min-w-0 table-fixed border border-form text-[10px]">
                  <colgroup>
                    <col style={{ width: embedMode ? 72 : 300 }} />
                    {data.weeks.map((w) => (
                      <col
                        key={`${w.year}-${w.week}`}
                        className={embedMode ? "w-[10px]" : "w-[1.75rem]"}
                      />
                    ))}
                    {embedMode && <col className="w-5" />}
                    {embedMode && data.consultantTotalHours != null && <col className="w-5" />}
                    {!embedMode && <col className="w-6" />}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-grid-subtle">
                      <th
                        rowSpan={2}
                        style={{ width: embedMode ? 72 : 300, maxWidth: embedMode ? 72 : 300, boxSizing: 'border-box' }}
                        className="border-r border-grid-subtle px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
                      >
                        <span className="block">Consultant / Project</span>
                        {!embedMode && (
                          <span className="mt-0.5 block text-[9px] font-normal uppercase tracking-wider text-text-primary opacity-55">
                            Internal
                          </span>
                        )}
                      </th>
                      {monthSpans.map((span, i) => (
                        <th
                          key={i}
                          colSpan={span.colSpan}
                          className="border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-primary opacity-60"
                        >
                          {span.label}
                        </th>
                      ))}
                      {embedMode && (
                        <th
                          rowSpan={2}
                          className="w-5 border-l border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-80"
                        >
                          Tot view
                        </th>
                      )}
                      {embedMode && data.consultantTotalHours != null && (
                        <th
                          rowSpan={2}
                          className="w-5 border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-80"
                        >
                          Tot
                          <br />
                          <span className="font-normal opacity-70">(Budget)</span>
                        </th>
                      )}
                      {!embedMode && (
                        <th
                          rowSpan={2}
                          className="w-6 border-r border-grid-subtle px-0 py-0.5 text-center"
                          aria-label="Remove booking"
                        />
                      )}
                    </tr>
                    <tr className="border-b border-grid-subtle">
                      {renderWeekHeaderCells("internal")}
                    </tr>
                  </thead>
                  <tbody>
                    {(embedMode ? perConsultantDisplay : perConsultantInternal).map((row) => {
                const expanded = expandedConsultants.has(row.consultant.id);
                const hasProjects = row.projectRows.length > 0;
                const isToPlan = row.consultant.id === TO_PLAN_CONSULTANT_ID;
                return (
                  <Fragment key={row.consultant.id}>
                    <tr
                      className={`border-b border-grid-light-subtle last:border-form ${isToPlan ? "bg-bg-muted/60" : ""} ${expanded && hasProjects ? "shadow-[0_2px_8px_rgba(0,0,0,0.28)]" : ""}`}
                    >
                      <td className={`border-r border-grid-light-subtle px-2 py-1.5 align-top ${embedMode ? "max-w-0" : ""}`}>
                        <div className={`flex items-center justify-between gap-1 w-full ${embedMode ? "min-w-0" : ""}`}>
                          <button
                            type="button"
                            onClick={() =>
                              hasProjects && toggleConsultant(row.consultant.id)
                            }
                            className={`flex min-w-0 flex-1 items-center gap-1 text-left ${embedMode ? "overflow-hidden" : "whitespace-nowrap"}`}
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
                            <span className={`font-medium text-text-primary ${embedMode ? "min-w-0 truncate" : ""}`} title={embedMode ? row.consultant.name : undefined}>
                              {row.consultant.name}
                              {!embedMode && row.consultant.teamName && (
                                <span className="ml-2 text-text-primary opacity-60">
                                  ({row.consultant.teamName})
                                </span>
                              )}
                              {row.consultant.isExternal && (
                                <span className="ml-1.5 shrink-0 rounded-sm bg-brand-blue/60 px-1 py-0.5 text-[10px] text-text-primary">
                                  External
                                </span>
                              )}
                            </span>
                          </button>
                          {row.consultant.id !== TO_PLAN_CONSULTANT_ID && (
                            <Link
                              href={`/consultants/${row.consultant.id}`}
                              className="shrink-0 rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
                              aria-label={`Open ${row.consultant.name}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                      {row.percentByWeek.map((pct, i) => {
                        const details = row.percentDetailsByWeek?.[i];
                        const totalHours = details?.total ?? 0;
                        const isOverallocated = !isToPlan && pct > 115;
                        const showHoursOnNameRow = embedMode || isToPlan;
                        const title =
                          showHoursOnNameRow && totalHours > 0
                            ? `${totalHours}`
                            : details && pct > 0
                              ? `${details.total} of ${details.available} (${pct}%)`
                              : undefined;
                        const hasBooking = isToPlan ? totalHours > 0 : (embedMode ? totalHours > 0 : pct > 0);
                        const prevHasBooking = i > 0 && (isToPlan ? (row.percentDetailsByWeek?.[i - 1]?.total ?? 0) > 0 : embedMode ? (row.percentDetailsByWeek?.[i - 1]?.total ?? 0) > 0 : (row.percentByWeek[i - 1] ?? 0) > 0);
                        const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                        const w = data.weeks[i];
                        const isDragRange =
                          cellDragConsultant?.id === row.consultant.id &&
                          cellDragWeekStart !== null &&
                          cellDragWeekEnd !== null &&
                          i >= Math.min(cellDragWeekStart, cellDragWeekEnd) &&
                          i <= Math.max(cellDragWeekStart, cellDragWeekEnd);
                        const dragMin = Math.min(cellDragWeekStart ?? 0, cellDragWeekEnd ?? 0);
                        const dragMax = Math.max(cellDragWeekStart ?? 0, cellDragWeekEnd ?? 0);
                        const isDragLeft = isDragRange && i === dragMin;
                        const isDragRight = isDragRange && i === dragMax;
                        return (
                          <td
                            key={`${w.year}-${w.week}`}
                            className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center text-[10px] tabular-nums overflow-hidden select-none cursor-crosshair ${!isDragRange && row.consultant.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${!isDragRange && !row.consultant.unavailableByWeek[i] && !isToPlan ? (embedMode ? (pct > 0 ? "bg-success/20" : "") : getAllocationCellBgClass(pct)) : ""} ${isCurrentWeek(w) && !row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isCurrentWeek(w) && row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${!isDragRange ? "hover:!bg-brand-blue/50" : ""} ${isDragRange ? "drag-range-cell border-t border-b" : ""} ${isDragLeft ? "border-l" : ""} ${isDragRight ? "border-r" : ""}`}
                            title={title}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCellDragConsultant({
                                id: row.consultant.id,
                                name: row.consultant.name,
                              });
                              setCellDragWeekStart(i);
                              setCellDragWeekEnd(i);
                            }}
                            onMouseEnter={() => {
                              if (cellDragConsultant?.id === row.consultant.id)
                                setCellDragWeekEnd(i);
                            }}
                          >
                            {hasBooking ? (
                              <span
                                className={
                                  isOverallocated
                                    ? "font-medium text-danger"
                                    : undefined
                                }
                              >
                                {showHoursOnNameRow ? `${totalHours}` : `${pct}%`}
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                      {embedMode && (() => {
                        const rowTotal = (row.percentDetailsByWeek ?? []).reduce(
                          (s, d) => s + (d?.total ?? 0),
                          0
                        );
                        return (
                          <td className="border-l border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary [border-left-color:var(--color-grid-border-subtle)]">
                            {rowTotal > 0 ? `${rowTotal}` : "\u00A0"}
                          </td>
                        );
                      })()}
                      {embedMode && data.consultantTotalHours != null && (() => {
                        const allTimeTotal = data.consultantTotalHours[row.consultant.id] ?? 0;
                        return (
                          <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary font-medium">
                            {allTimeTotal > 0 ? `${allTimeTotal}` : "\u00A0"}
                          </td>
                        );
                      })()}
                      {!embedMode && <td className="border-r border-grid-light-subtle px-0 py-0.5 w-6" />}
                    </tr>
                    {expanded &&
                      row.projectRows.map((pr) => {
                        const allocationsWithBooking: DeleteBookingItem[] = [];
                        pr.weeks.forEach((w, i) => {
                          if (w.cell?.id && w.cell.hours > 0 && data.weeks[i]) {
                            allocationsWithBooking.push({
                              allocationId: w.cell.id,
                              year: data.weeks[i].year,
                              week: data.weeks[i].week,
                            });
                          }
                        });
                        const hasAnyBooking = allocationsWithBooking.length > 0;
                        return (
                        <tr
                          key={pr.projectId + (pr.roleName || "")}
                          className="border-b border-grid-light-subtle last:border-form"
                          style={{
                            backgroundColor: `${pr.customerColor}18`,
                          }}
                        >
                          <td className={`border-r border-grid-light-subtle px-2 py-1 pl-8 text-[10px] text-text-primary ${embedMode ? "max-w-0" : ""}`}>
                            <span className={`flex items-center gap-1 ${embedMode ? "min-w-0 overflow-hidden" : "whitespace-nowrap"}`}>
                              {!embedMode && pr.showProbabilitySymbol && (
                                <Percent
                                  className="h-3 w-3 shrink-0 opacity-60"
                                  aria-label="Probability below 100%"
                                />
                              )}
                              <span className={embedMode ? "min-w-0 truncate" : ""} title={embedMode ? (pr.roleName || row.consultant.defaultRoleName) || undefined : undefined}>
                                {embedMode ? (
                                  pr.roleName || row.consultant.defaultRoleName || "\u00A0"
                                ) : (
                                  <>
                                    {pr.customerId ? (
                                      <Link
                                        href={`/customers/${pr.customerId}`}
                                        className="cursor-pointer hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {pr.customerName}
                                      </Link>
                                    ) : (
                                      pr.customerName
                                    )}
                                    {" - "}
                                    <Link
                                      href={`/projects/${pr.projectId}`}
                                      className="cursor-pointer hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {pr.projectName}
                                    </Link>
                                    {(pr.roleName || row.consultant.defaultRoleName) && (
                                      <span className="ml-2 text-text-primary opacity-70">
                                        · {pr.roleName || row.consultant.defaultRoleName}
                                      </span>
                                    )}
                                  </>
                                )}
                              </span>
                            </span>
                          </td>
                          {pr.weeks.map((w, i) => {
                            const weekKey = data.weeks[i];
                            const roleId =
                              w.cell?.roleId ??
                              pr.weeks.find((wk) => wk.cell?.roleId)?.cell
                                ?.roleId ??
                              null;
                            const cellKey = allocationCellKey(
                              row.consultant.id,
                              pr.projectId,
                              roleId,
                              weekKey.year,
                              w.week
                            );
                            const optimisticHours = optimisticCellHours[cellKey];
                            const effectiveDisplayHours =
                              optimisticHours != null ? optimisticHours : w.cell?.displayHours;
                            const hasBooking = (effectiveDisplayHours ?? 0) > 0;
                            const prevWeek = i > 0 ? pr.weeks[i - 1] : null;
                            const prevCellKey =
                              prevWeek && data.weeks[i - 1]
                                ? allocationCellKey(
                                    row.consultant.id,
                                    pr.projectId,
                                    prevWeek.cell?.roleId ??
                                      pr.weeks.find((x) => x.cell?.roleId)?.cell
                                        ?.roleId ??
                                      null,
                                    data.weeks[i - 1].year,
                                    prevWeek.week
                                  )
                                : "";
                            const prevEffective =
                              prevCellKey && optimisticCellHours[prevCellKey] != null
                                ? optimisticCellHours[prevCellKey]
                                : prevWeek?.cell?.displayHours;
                            const prevHasBooking = (prevEffective ?? 0) > 0;
                            const displayText =
                              w.cell?.isHidden && optimisticHours == null
                                ? "—"
                                : effectiveDisplayHours != null &&
                                    effectiveDisplayHours > 0
                                  ? `${effectiveDisplayHours}`
                                  : null;
                            const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                            const isEditingConsultant =
                              editingCellConsultant?.consultantId ===
                                row.consultant.id &&
                              editingCellConsultant?.projectId === pr.projectId &&
                              editingCellConsultant?.weekIndex === i;
                            const effectiveHours =
                              optimisticHours != null ? optimisticHours : (w.cell?.hours ?? 0);
                            const openEditor = () => {
                              setEditingCellConsultant({
                                consultantId: row.consultant.id,
                                projectId: pr.projectId,
                                roleId,
                                weekIndex: i,
                                week: w.week,
                                year: weekKey.year,
                                allocationId: w.cell?.id ?? null,
                                currentHours: effectiveHours,
                              });
                              setEditingCellConsultantValue(
                                String(effectiveHours)
                              );
                            };
                            const isProjectDragRange =
                              projectRowDrag?.consultantId === row.consultant.id &&
                              projectRowDrag?.projectId === pr.projectId &&
                              i >= Math.min(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd) &&
                              i <= Math.max(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd);
                            return (
                            <td
                              key={`${weekKey.year}-${weekKey.week}`}
                              className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} p-0 py-1 text-center select-none cursor-pointer ${row.consultant.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${isCurrentWeek(data.weeks[i]) && !row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isCurrentWeek(data.weeks[i]) && row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${isEditingConsultant ? "align-middle" : ""} ${isProjectDragRange ? "drag-range-cell border-t border-b border-l border-r border-brand-signal bg-brand-signal/20" : ""}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setProjectRowDrag({
                                  consultantId: row.consultant.id,
                                  projectId: pr.projectId,
                                  roleId,
                                  consultantName: row.consultant.name,
                                  projectLabel: `${pr.customerName} - ${pr.projectName}`,
                                  roleName: pr.roleName ?? row.consultant.defaultRoleName ?? undefined,
                                  weekIndexStart: i,
                                  weekIndexEnd: i,
                                });
                                setProjectRowDragMoved(false);
                              }}
                              onMouseEnter={() => {
                                if (projectRowDrag?.consultantId === row.consultant.id && projectRowDrag?.projectId === pr.projectId) {
                                  setProjectRowDrag((prev) => (prev ? { ...prev, weekIndexEnd: i } : null));
                                  setProjectRowDragMoved(true);
                                }
                              }}
                            >
                              {isEditingConsultant ? (
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={editingCellConsultantValue}
                                  onChange={(e) =>
                                    setEditingCellConsultantValue(
                                      e.target.value
                                    )
                                  }
                                  onFocus={(e) => e.target.select()}
                                  onBlur={handleCellConsultantInputBlur}
                                  onKeyDown={
                                    handleCellConsultantInputKeyDown
                                  }
                                  disabled={savingCellConsultant}
                                  className="w-full min-w-0 max-w-[3rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (preventNextCellClickRef.current) {
                                      preventNextCellClickRef.current = false;
                                      return;
                                    }
                                    openEditor();
                                  }}
                                  className="block w-full min-h-[1.5rem] cursor-pointer border-0 bg-transparent px-1 py-0.5 text-center text-[10px] text-text-primary hover:bg-bg-muted/50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-signal"
                                  tabIndex={0}
                                >
                                  {displayText ?? "\u00A0"}
                                </button>
                              )}
                            </td>
                          );
                          })}
                          {embedMode && (() => {
                            const prRowTotal = pr.weeks.reduce((s, w, i) => {
                              const weekKey = data.weeks[i];
                              const roleId =
                                w.cell?.roleId ??
                                pr.weeks.find((x) => x.cell?.roleId)?.cell?.roleId ??
                                null;
                              const cellKey = weekKey
                                ? allocationCellKey(
                                    row.consultant.id,
                                    pr.projectId,
                                    roleId,
                                    weekKey.year,
                                    w.week
                                  )
                                : "";
                              const opt = optimisticCellHours[cellKey];
                              const hours =
                                opt != null ? opt : (w.cell?.displayHours ?? 0);
                              return s + hours;
                            }, 0);
                            return (
                              <td className="border-l border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary align-middle [border-left-color:var(--color-grid-border-subtle)]">
                                {prRowTotal > 0 ? `${prRowTotal}` : "\u00A0"}
                              </td>
                            );
                          })()}
                          {embedMode && data.consultantTotalHours != null && (
                            <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] text-text-primary align-middle">
                              {"\u00A0"}
                            </td>
                          )}
                          {!embedMode && (
                            <td className="border-r border-grid-light-subtle px-0 py-0.5 w-6 align-middle text-center">
                              {hasAnyBooking ? (
                                <button
                                  type="button"
                                  disabled={loadingDeleteBooking}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const roleId =
                                      pr.weeks.find((wk) => wk.cell?.roleId)?.cell?.roleId ?? null;
                                    setLoadingDeleteBooking(true);
                                    try {
                                      const list = await getBookingAllocationsForRow(
                                        row.consultant.id === TO_PLAN_CONSULTANT_ID ? null : row.consultant.id,
                                        pr.projectId,
                                        roleId
                                      );
                                      setDeleteBookingDialog({
                                        consultantId: row.consultant.id,
                                        consultantName: row.consultant.name,
                                        projectId: pr.projectId,
                                        projectLabel: `${pr.customerName} - ${pr.projectName}`,
                                        allocations: list.map((a) => ({
                                          allocationId: a.id,
                                          year: a.year,
                                          week: a.week,
                                        })),
                                        selectedAllocationIds: new Set(),
                                      });
                                    } catch (err) {
                                      alert(err instanceof Error ? err.message : "Failed to load booking");
                                    } finally {
                                      setLoadingDeleteBooking(false);
                                    }
                                  }}
                                  className="cursor-pointer inline-flex rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100 hover:text-danger focus:outline-none focus:ring-2 focus:ring-brand-signal disabled:opacity-50"
                                  aria-label="Remove booking"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </td>
                          )}
                        </tr>
                      );
                      })}
                  </Fragment>
                );
              })}
                  </tbody>
                  {embedMode && (
                  <tfoot>
                    <tr className="border-t-2 border-grid-subtle bg-bg-muted/60">
                      <td className="border-r border-grid-light-subtle px-2 py-1 text-[10px] font-medium text-text-primary">
                        Week total (h)
                      </td>
                      {data.weeks.map((w, i) => (
                        <td
                          key={`ft-h-${w.year}-${w.week}`}
                          className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary"
                        >
                          {weekTotalsHours[i] > 0 ? `${weekTotalsHours[i]}` : "\u00A0"}
                        </td>
                      ))}
                      <td className="border-l border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary [border-left-color:var(--color-grid-border-subtle)]">
                        {grandTotalHours > 0 ? `${grandTotalHours}` : "\u00A0"}
                      </td>
                      {data.consultantTotalHours != null && (
                        <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] font-medium tabular-nums text-text-primary">
                          {Object.values(data.consultantTotalHours).reduce((a, b) => a + b, 0) > 0
                            ? `${Object.values(data.consultantTotalHours).reduce((a, b) => a + b, 0)}`
                            : "\u00A0"}
                          {embedMode?.budgetHours != null && (
                            <>
                              <br />
                              <span className="opacity-70">({embedMode.budgetHours})</span>
                            </>
                          )}
                        </td>
                      )}
                      {!embedMode && <td className="w-6 border-r border-grid-light-subtle px-0 py-0.5" />}
                    </tr>
                    <tr className="border-t border-grid-subtle bg-bg-muted/40">
                      <td className="border-r border-grid-light-subtle px-2 py-1 text-[10px] font-medium text-text-primary">
                        Revenue total
                      </td>
                      {data.weeks.map((w, i) => (
                        <td
                          key={`ft-m-${w.year}-${w.week}`}
                          className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary"
                        >
                          {weekTotalsMoney != null
                            ? formatAllocationEmbedRevenue(weekTotalsMoney[i] ?? 0)
                            : "—"}
                        </td>
                      ))}
                      <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] tabular-nums text-text-primary">
                        {weekTotalsMoney != null
                          ? formatAllocationEmbedRevenue(grandTotalMoney)
                          : "—"}
                      </td>
                      {data.consultantTotalHours != null && (
                        <td className="border-r border-grid-light-subtle px-1 py-1 text-center text-[10px] font-medium tabular-nums text-text-primary">
                          {weekTotalsMoney != null
                            ? formatAllocationEmbedRevenue(grandTotalMoney)
                            : "—"}
                          {embedMode?.budgetMoney != null && (
                            <>
                              <br />
                              <span className="opacity-70">({formatAllocationEmbedRevenue(embedMode.budgetMoney)})</span>
                            </>
                          )}
                        </td>
                      )}
                      {!embedMode && <td className="w-6 border-r border-grid-light-subtle px-0 py-0.5" />}
                    </tr>
                  </tfoot>
                  )}
                </table>
              </div>
              {!embedMode && (
              <div className="p-2">
                <table className="w-full min-w-0 table-fixed border border-form text-[10px]">
                  <colgroup>
                    <col style={{ width: 300 }} />
                    {data.weeks.map((w) => (
                      <col key={`ext-${w.year}-${w.week}`} className="w-[1.75rem]" />
                    ))}
                    <col className="w-6" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-grid-subtle">
                      <th
                        rowSpan={2}
                        style={{ width: 300, maxWidth: 300, boxSizing: 'border-box' }}
                        className="border-r border-grid-subtle px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
                      >
                        <span className="block">Consultant / Project</span>
                        <span className="mt-0.5 block text-[9px] font-normal uppercase tracking-wider text-text-primary opacity-55">
                          External
                        </span>
                      </th>
                      {monthSpans.map((span, i) => (
                        <th
                          key={i}
                          colSpan={span.colSpan}
                          className="border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-primary opacity-60"
                        >
                          {span.label}
                        </th>
                      ))}
                      <th
                        rowSpan={2}
                        className="w-6 border-r border-grid-subtle px-0 py-0.5 text-center"
                        aria-label="Remove booking"
                      />
                    </tr>
                    <tr className="border-b border-grid-subtle">
                      {renderWeekHeaderCells("external")}
                    </tr>
                  </thead>
                  <tbody>
                    {perConsultantExternal.map((row) => {
                const expanded = expandedConsultants.has(row.consultant.id);
                const hasProjects = row.projectRows.length > 0;
                return (
                  <Fragment key={row.consultant.id}>
                    <tr
                      className={`border-b border-grid-light-subtle last:border-form ${expanded && hasProjects ? "shadow-[0_2px_8px_rgba(0,0,0,0.28)]" : ""}`}
                    >
                      <td className="border-r border-grid-light-subtle px-2 py-1.5 align-top">
                        <div className="flex items-center justify-between gap-1 w-full">
                          <button
                            type="button"
                            onClick={() =>
                              hasProjects && toggleConsultant(row.consultant.id)
                            }
                            className="flex min-w-0 flex-1 items-center gap-1 whitespace-nowrap text-left"
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
                            <span className="font-medium text-text-primary">
                              {row.consultant.name}
                              {row.consultant.teamName && (
                                <span className="ml-2 text-text-primary opacity-60">
                                  ({row.consultant.teamName})
                                </span>
                              )}
                              <span className="ml-1.5 shrink-0 rounded-sm bg-brand-blue/60 px-1 py-0.5 text-[10px] text-text-primary">
                                External
                              </span>
                            </span>
                            {expanded && hasProjects && (
                              <span
                                className={`shrink-0 ${
                                  Math.max(
                                    ...row.percentByWeek.filter((p) => p > 0),
                                    0
                                  ) > 115
                                    ? "font-medium text-danger"
                                    : "text-text-primary opacity-60"
                                }`}
                              >
                                (
                                {Math.max(
                                  ...row.percentByWeek.filter((p) => p > 0),
                                  0
                                )}
                                %)
                              </span>
                            )}
                          </button>
                          <Link
                            href={`/consultants/${row.consultant.id}`}
                            className="shrink-0 rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100"
                            aria-label={`Open ${row.consultant.name}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                      {row.percentByWeek.map((pct, i) => {
                        const details = row.percentDetailsByWeek?.[i];
                        const isOverallocated = pct > 115;
                        const title =
                          details && pct > 0
                            ? `${details.total} of ${details.available} (${pct}%)`
                            : undefined;
                        const hasBooking = pct > 0;
                        const prevHasBooking = i > 0 && (row.percentByWeek[i - 1] ?? 0) > 0;
                        const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                        const w = data.weeks[i];
                        const isDragRange =
                          cellDragConsultant?.id === row.consultant.id &&
                          cellDragWeekStart !== null &&
                          cellDragWeekEnd !== null &&
                          i >= Math.min(cellDragWeekStart, cellDragWeekEnd) &&
                          i <= Math.max(cellDragWeekStart, cellDragWeekEnd);
                        const dragMin = Math.min(cellDragWeekStart ?? 0, cellDragWeekEnd ?? 0);
                        const dragMax = Math.max(cellDragWeekStart ?? 0, cellDragWeekEnd ?? 0);
                        const isDragLeft = isDragRange && i === dragMin;
                        const isDragRight = isDragRange && i === dragMax;
                        return (
                          <td
                            key={`${w.year}-${w.week}`}
                            className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center text-[10px] tabular-nums overflow-hidden select-none cursor-crosshair ${!isDragRange && row.consultant.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${!isDragRange && !row.consultant.unavailableByWeek[i] ? getAllocationCellBgClass(pct) : ""} ${isCurrentWeek(w) && !row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isCurrentWeek(w) && row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${!isDragRange ? "hover:!bg-brand-blue/50" : ""} ${isDragRange ? "drag-range-cell border-t border-b" : ""} ${isDragLeft ? "border-l" : ""} ${isDragRight ? "border-r" : ""}`}
                            title={title}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCellDragConsultant({
                                id: row.consultant.id,
                                name: row.consultant.name,
                              });
                              setCellDragWeekStart(i);
                              setCellDragWeekEnd(i);
                            }}
                            onMouseEnter={() => {
                              if (cellDragConsultant?.id === row.consultant.id)
                                setCellDragWeekEnd(i);
                            }}
                          >
                            {hasBooking ? (
                              <span
                                className={
                                  isOverallocated
                                    ? "font-medium text-danger"
                                    : undefined
                                }
                              >
                                {pct}%
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="border-r border-grid-light-subtle px-0 py-0.5 w-6" />
                    </tr>
                    {expanded &&
                      row.projectRows.map((pr) => {
                        const allocationsWithBooking: DeleteBookingItem[] = [];
                        pr.weeks.forEach((w, i) => {
                          if (w.cell?.id && w.cell.hours > 0 && data.weeks[i]) {
                            allocationsWithBooking.push({
                              allocationId: w.cell.id,
                              year: data.weeks[i].year,
                              week: data.weeks[i].week,
                            });
                          }
                        });
                        const hasAnyBooking = allocationsWithBooking.length > 0;
                        return (
                        <tr
                          key={pr.projectId}
                          className="border-b border-grid-light-subtle last:border-form"
                          style={{
                            backgroundColor: `${pr.customerColor}18`,
                          }}
                        >
                          <td className="border-r border-grid-light-subtle px-2 py-1 pl-8 text-[10px] text-text-primary">
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              {pr.showProbabilitySymbol && (
                                <Percent
                                  className="h-3 w-3 shrink-0 opacity-60"
                                  aria-label="Probability below 100%"
                                />
                              )}
                              {pr.customerId ? (
                                <Link
                                  href={`/customers/${pr.customerId}`}
                                  className="cursor-pointer hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {pr.customerName}
                                </Link>
                              ) : (
                                pr.customerName
                              )}
                              {" - "}
                              <Link
                                href={`/projects/${pr.projectId}`}
                                className="cursor-pointer hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {pr.projectName}
                              </Link>
                              {(pr.roleName || row.consultant.defaultRoleName) && (
                                <span className="ml-2 text-text-primary opacity-70">
                                  · {pr.roleName || row.consultant.defaultRoleName}
                                </span>
                              )}
                            </span>
                          </td>
                          {pr.weeks.map((w, i) => {
                            const weekKey = data.weeks[i];
                            const roleId =
                              w.cell?.roleId ??
                              pr.weeks.find((wk) => wk.cell?.roleId)?.cell
                                ?.roleId ??
                              null;
                            const cellKey = allocationCellKey(
                              row.consultant.id,
                              pr.projectId,
                              roleId,
                              weekKey.year,
                              w.week
                            );
                            const optimisticHours = optimisticCellHours[cellKey];
                            const effectiveDisplayHours =
                              optimisticHours != null ? optimisticHours : w.cell?.displayHours;
                            const hasBooking = (effectiveDisplayHours ?? 0) > 0;
                            const prevWeek = i > 0 ? pr.weeks[i - 1] : null;
                            const prevCellKey =
                              prevWeek && data.weeks[i - 1]
                                ? allocationCellKey(
                                    row.consultant.id,
                                    pr.projectId,
                                    prevWeek.cell?.roleId ??
                                      pr.weeks.find((x) => x.cell?.roleId)?.cell
                                        ?.roleId ??
                                      null,
                                    data.weeks[i - 1].year,
                                    prevWeek.week
                                  )
                                : "";
                            const prevEffective =
                              prevCellKey && optimisticCellHours[prevCellKey] != null
                                ? optimisticCellHours[prevCellKey]
                                : prevWeek?.cell?.displayHours;
                            const prevHasBooking = (prevEffective ?? 0) > 0;
                            const displayText =
                              w.cell?.isHidden && optimisticHours == null
                                ? "—"
                                : effectiveDisplayHours != null &&
                                    effectiveDisplayHours > 0
                                  ? `${effectiveDisplayHours}`
                                  : null;
                            const showLeftBorder = hasBooking && (i === 0 || !prevHasBooking);
                            const isEditingConsultant =
                              editingCellConsultant?.consultantId ===
                                row.consultant.id &&
                              editingCellConsultant?.projectId === pr.projectId &&
                              editingCellConsultant?.weekIndex === i;
                            const effectiveHours =
                              optimisticHours != null ? optimisticHours : (w.cell?.hours ?? 0);
                            const openEditorExt = () => {
                              setEditingCellConsultant({
                                consultantId: row.consultant.id,
                                projectId: pr.projectId,
                                roleId,
                                weekIndex: i,
                                week: w.week,
                                year: weekKey.year,
                                allocationId: w.cell?.id ?? null,
                                currentHours: effectiveHours,
                              });
                              setEditingCellConsultantValue(
                                String(effectiveHours)
                              );
                            };
                            const isProjectDragRangeExt =
                              projectRowDrag?.consultantId === row.consultant.id &&
                              projectRowDrag?.projectId === pr.projectId &&
                              i >= Math.min(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd) &&
                              i <= Math.max(projectRowDrag.weekIndexStart, projectRowDrag.weekIndexEnd);
                            return (
                            <td
                              key={`${weekKey.year}-${weekKey.week}`}
                              className={`${showLeftBorder ? "border-l border-grid-light-subtle " : ""}${hasBooking ? "border-r border-grid-light-subtle" : ""} p-0 py-1 text-center select-none cursor-pointer ${row.consultant.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${isCurrentWeek(data.weeks[i]) && !row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${isCurrentWeek(data.weeks[i]) && row.consultant.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} ${isEditingConsultant ? "align-middle" : ""} ${isProjectDragRangeExt ? "drag-range-cell border-t border-b border-l border-r border-brand-signal bg-brand-signal/20" : ""}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setProjectRowDrag({
                                  consultantId: row.consultant.id,
                                  projectId: pr.projectId,
                                  roleId,
                                  consultantName: row.consultant.name,
                                  projectLabel: `${pr.customerName} - ${pr.projectName}`,
                                  roleName: pr.roleName ?? row.consultant.defaultRoleName ?? undefined,
                                  weekIndexStart: i,
                                  weekIndexEnd: i,
                                });
                                setProjectRowDragMoved(false);
                              }}
                              onMouseEnter={() => {
                                if (projectRowDrag?.consultantId === row.consultant.id && projectRowDrag?.projectId === pr.projectId) {
                                  setProjectRowDrag((prev) => (prev ? { ...prev, weekIndexEnd: i } : null));
                                  setProjectRowDragMoved(true);
                                }
                              }}
                            >
                              {isEditingConsultant ? (
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={editingCellConsultantValue}
                                  onChange={(e) =>
                                    setEditingCellConsultantValue(
                                      e.target.value
                                    )
                                  }
                                  onFocus={(e) => e.target.select()}
                                  onBlur={handleCellConsultantInputBlur}
                                  onKeyDown={
                                    handleCellConsultantInputKeyDown
                                  }
                                  disabled={savingCellConsultant}
                                  className="w-full min-w-0 max-w-[3rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (preventNextCellClickRef.current) {
                                      preventNextCellClickRef.current = false;
                                      return;
                                    }
                                    openEditorExt();
                                  }}
                                  className="block w-full min-h-[1.5rem] cursor-pointer border-0 bg-transparent px-1 py-0.5 text-center text-[10px] text-text-primary hover:bg-bg-muted/50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-signal"
                                  tabIndex={0}
                                >
                                  {displayText ?? "\u00A0"}
                                </button>
                              )}
                            </td>
                          );
                          })}
                          <td className="border-r border-grid-light-subtle px-0 py-0.5 w-6 align-middle text-center">
                            {hasAnyBooking ? (
                              <button
                                type="button"
                                disabled={loadingDeleteBooking}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const roleId =
                                    pr.weeks.find((wk) => wk.cell?.roleId)?.cell?.roleId ?? null;
                                  setLoadingDeleteBooking(true);
                                  try {
                                    const list = await getBookingAllocationsForRow(
                                      row.consultant.id === TO_PLAN_CONSULTANT_ID ? null : row.consultant.id,
                                      pr.projectId,
                                      roleId
                                    );
                                    setDeleteBookingDialog({
                                      consultantId: row.consultant.id,
                                      consultantName: row.consultant.name,
                                      projectId: pr.projectId,
                                      projectLabel: `${pr.customerName} - ${pr.projectName}`,
                                      allocations: list.map((a) => ({
                                        allocationId: a.id,
                                        year: a.year,
                                        week: a.week,
                                      })),
                                      selectedAllocationIds: new Set(),
                                    });
                                  } catch (err) {
                                    alert(err instanceof Error ? err.message : "Failed to load booking");
                                  } finally {
                                    setLoadingDeleteBooking(false);
                                  }
                                }}
                                className="cursor-pointer inline-flex rounded p-0.5 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100 hover:text-danger focus:outline-none focus:ring-2 focus:ring-brand-signal disabled:opacity-50"
                                aria-label="Remove booking"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                      })}
                  </Fragment>
                );
              })}
                  </tbody>
                </table>
              </div>
              )}
            </>
  );
}
