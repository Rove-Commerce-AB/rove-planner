"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, Percent } from "lucide-react";
import type { AllocationPageData } from "@/lib/allocationPage";

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
  editingCell: unknown;
  setEditingCell: (v: unknown) => void;
  editingCellValue: string;
  setEditingCellValue: (v: string) => void;
  handleCellInputBlur: () => void;
  handleCellInputKeyDown: (e: React.KeyboardEvent) => void;
  savingCell: boolean;
  setAddModalOpen: (v: boolean) => void;
  setAddInitialParams: (v: unknown) => void;
  editingCellConsultant: unknown;
  setEditingCellConsultant: (v: unknown) => void;
  editingCellConsultantValue: string;
  setEditingCellConsultantValue: (v: string) => void;
  saveCellHoursConsultant: (cell: unknown, value: string) => Promise<void>;
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

  if (tab === "customer") {
    return (
      <div className="p-2">
        {weekNav(p)}
        <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
          <colgroup>
            <col style={{ width: 300 }} />
            {data.weeks.map((w) => (
              <col key={`${w.year}-${w.week}`} className="w-[1.75rem]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-grid">
              <th
                rowSpan={2}
                style={{ width: 300, maxWidth: 300, boxSizing: "border-box" }}
                className="border-r border-grid px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
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
            <tr className="border-b border-grid">
              {p.renderWeekHeaderCells("customer", "border-grid")}
            </tr>
          </thead>
          <tbody>
            {(p.perCustomer as Array<{ customer: { id: string; name: string }; consultantRows: unknown[]; totalByWeek: Map<string, number> }>).map((row) => {
              const expanded = p.expandedCustomers.has(row.customer.id);
              const hasConsultants = row.consultantRows.length > 0;
              return (
                <Fragment key={row.customer.id}>
                  <tr className="border-b border-grid-light last:border-border bg-bg-muted/60">
                    <td className="border-r border-grid-light px-2 py-1 align-top">
                      <button
                        type="button"
                        onClick={() => hasConsultants && p.toggleCustomer(row.customer.id)}
                        className="flex items-center gap-1 whitespace-nowrap text-left"
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
                        <span className="font-semibold text-text-primary">{row.customer.name}</span>
                      </button>
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
                          className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center text-text-primary ${p.isCurrentWeek(data.weeks[i]) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""}`}
                        >
                          {hasBooking ? `${total}h` : null}
                        </td>
                      );
                    })}
                  </tr>
                  {expanded &&
                    (row.consultantRows as Array<{
                      consultantId: string;
                      consultantName: string;
                      roleId: string | null;
                      roleName: string;
                      weeks: { week: number; cells: { id: string; hours: number; displayHours: number; isHidden: boolean; projectId: string }[] }[];
                      unavailableByWeek: boolean[];
                    }>).map((cr) => (
                      <tr
                        key={`${cr.consultantId}-${cr.roleId ?? "none"}`}
                        className="border-b border-grid-light last:border-border bg-bg-default"
                      >
                        <td className="border-r border-grid-light px-2 py-1 pl-8 text-[10px]">
                          <span className="whitespace-nowrap font-normal text-text-primary">
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
                              className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center cursor-pointer ${cr.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${p.isCurrentWeek(weekInfo) && !cr.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${p.isCurrentWeek(weekInfo) && cr.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} hover:bg-bg-muted/50 ${isEditing ? "p-0 align-middle" : ""}`}
                              onClick={(e) => {
                                if ((e.target as HTMLElement).closest("input")) return;
                                p.setEditingCell({
                                  customerId: row.customer.id,
                                  consultantId: cr.consultantId,
                                  roleId: cr.roleId,
                                  weekIndex: i,
                                  week: w.week,
                                  year: weekInfo.year,
                                  allocationId: cells[0]?.id ?? null,
                                  otherAllocationIds: cells.slice(1).map((c) => c.id),
                                  projectId: cells[0]?.projectId ?? firstProjectForCustomer?.id ?? "",
                                  currentHours: totalHours,
                                });
                                p.setEditingCellValue(String(totalHours || ""));
                              }}
                            >
                              {isEditing ? (
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
                                  className="w-full min-w-0 max-w-[3rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                              ) : displayTotal > 0 ? (
                                <span className="text-[10px] text-text-primary">{displayTotal}h</span>
                              ) : totalHours > 0 ? (
                                <span className="text-[10px] text-text-primary opacity-70">—</span>
                              ) : null}
                            </td>
                          );
                        })}
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
      <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
        <colgroup>
          <col style={{ width: 300 }} />
          {data.weeks.map((w) => (
            <col key={`${w.year}-${w.week}`} className="w-[1.75rem]" />
          ))}
          <col className="w-[4rem]" />
        </colgroup>
        <thead>
          <tr className="border-b border-grid">
            <th
              rowSpan={2}
              style={{ width: 300, maxWidth: 300, boxSizing: "border-box" }}
              className="border-r border-grid px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
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
          <tr className="border-b border-grid">
            {p.renderWeekHeaderCells("project", "border-grid")}
          </tr>
        </thead>
        <tbody>
          {perProject.map((row) => {
            const expanded = p.expandedProjects.has(row.project.id);
            const hasConsultants = row.consultantRows.length > 0;
            return (
              <Fragment key={row.project.id}>
                <tr className="border-b border-grid-light last:border-border bg-bg-muted/60">
                  <td className="border-r border-grid-light px-2 py-1 align-top">
                    <button
                      type="button"
                      onClick={() => hasConsultants && p.toggleProject(row.project.id)}
                      className="flex items-center gap-1 whitespace-nowrap text-left"
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
                      <span className="flex items-center gap-1 font-semibold text-text-primary">
                        {row.project.showProbabilitySymbol && (
                          <Percent
                            className="h-3 w-3 shrink-0 opacity-60"
                            aria-label="Probability under 100%"
                          />
                        )}
                        {row.project.label}
                      </span>
                    </button>
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
                        className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center text-text-primary ${p.isCurrentWeek(data.weeks[i]) ? "current-week-cell border-l border-r bg-brand-signal/15" : ""}`}
                      >
                        {hasBooking ? `${total}h` : null}
                      </td>
                    );
                  })}
                  <td className="border-r border-grid-light px-1 py-1 text-right font-medium text-text-primary tabular-nums">
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
                      className="border-b border-grid-light last:border-border bg-bg-default"
                    >
                      <td className="border-r border-grid-light px-2 py-1 pl-8 text-[10px]">
                        <span className="whitespace-nowrap font-normal text-text-primary">
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
                            className={`${showLeftBorder ? "border-l border-grid-light " : ""}${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center cursor-pointer ${cr.unavailableByWeek[i] ? "!bg-[var(--color-border-default)] text-text-primary" : ""} ${p.isCurrentWeek(weekInfo) && !cr.unavailableByWeek[i] ? "current-week-cell border-l border-r bg-brand-signal/15" : ""} ${p.isCurrentWeek(weekInfo) && cr.unavailableByWeek[i] ? "current-week-cell border-l border-r" : ""} hover:bg-bg-muted/50 ${isEditing ? "p-0 align-middle" : ""}`}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest("input")) return;
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
                          >
                            {isEditing ? (
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
                                className="w-full min-w-0 max-w-[3rem] rounded border border-brand-signal bg-bg-default px-1 py-0.5 text-center text-[10px] text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            ) : displayTotal > 0 ? (
                              <span className="text-[10px] text-text-primary">{displayTotal}h</span>
                            ) : totalHours > 0 ? (
                              <span className="text-[10px] text-text-primary opacity-70">—</span>
                            ) : null}
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
