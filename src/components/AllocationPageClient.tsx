"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { getCurrentYearWeek, getMonthSpansForWeeks } from "@/lib/dateUtils";
import type { AllocationPageData } from "@/lib/allocationPage";
import { Button, Select, Tabs, TabsList, TabsTrigger, PageHeader } from "@/components/ui";
import { AddAllocationModal } from "./AddAllocationModal";
import { EditAllocationModal } from "./EditAllocationModal";

type Props = {
  data: AllocationPageData | null;
  error: string | null;
  year: number;
  weekFrom: number;
  weekTo: number;
};

function buildPerConsultantView(data: AllocationPageData) {
  const roleMap = new Map(data.roles.map((r) => [r.id, r.name]));
  const projectMap = new Map(
    data.projects.map((p) => [
      p.id,
      { name: p.name, customerName: p.customerName, customerColor: p.customerColor },
    ])
  );

  const byConsultant = new Map<
    string,
    Map<string, Map<number, { id: string; hours: number; roleName: string; roleId: string | null }>>
  >();

  for (const a of data.allocations) {
    if (!byConsultant.has(a.consultant_id)) {
      byConsultant.set(
        a.consultant_id,
        new Map()
      );
    }
    const byProject = byConsultant.get(a.consultant_id)!;
    if (!byProject.has(a.project_id)) {
      byProject.set(a.project_id, new Map());
    }
    const byWeek = byProject.get(a.project_id)!;
    byWeek.set(a.week, {
      id: a.id,
      hours: a.hours,
      roleName: a.role_id ? roleMap.get(a.role_id) ?? "Unknown" : "",
      roleId: a.role_id,
    });
  }

  const sortedConsultants = [...data.consultants].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return sortedConsultants.map((c) => {
    const projectsMap = byConsultant.get(c.id);
    const projectRows: { projectId: string; projectName: string; customerName: string; customerColor: string; roleName: string; weeks: { week: number; cell: { id: string; hours: number; roleName: string; roleId: string | null } | null }[] }[] = [];

    if (projectsMap) {
      const rows: (typeof projectRows)[number][] = [];
      for (const [projectId, byWeek] of projectsMap) {
        const proj = projectMap.get(projectId);
        const weeks = data.weeks.map((w) => ({
          week: w.week,
          cell: byWeek.get(w.week) ?? null,
        }));
        const firstCellWithRole = weeks.find((w) => w.cell?.roleName);
        const roleName = firstCellWithRole?.cell?.roleName ?? "";
        rows.push({
          projectId,
          projectName: proj?.name ?? "Unknown",
          customerName: proj?.customerName ?? "",
          customerColor: proj?.customerColor ?? DEFAULT_CUSTOMER_COLOR,
          roleName,
          weeks,
        });
      }
      rows.sort((a, b) => a.projectName.localeCompare(b.projectName));
      projectRows.push(...rows);
    }

    const totalByWeek = new Map<number, number>();
    for (const pr of projectRows) {
      for (const { week, cell } of pr.weeks) {
        if (cell && cell.hours > 0) {
          totalByWeek.set(week, (totalByWeek.get(week) ?? 0) + cell.hours);
        }
      }
    }

    const percentByWeek = data.weeks.map((w, i) => {
      const total = totalByWeek.get(w.week) ?? 0;
      const available = c.availableHoursByWeek[i] ?? c.hoursPerWeek;
      return available > 0 ? Math.round((total / available) * 100) : 0;
    });

    const percentDetailsByWeek = data.weeks.map((w, i) => {
      const total = totalByWeek.get(w.week) ?? 0;
      const available = c.availableHoursByWeek[i] ?? c.hoursPerWeek;
      const pct = available > 0 ? Math.round((total / available) * 100) : 0;
      return { total, available, pct };
    });

    return {
      consultant: c,
      projectRows,
      percentByWeek: percentDetailsByWeek.map((d) => d.pct),
      percentDetailsByWeek,
      totalByWeek,
    };
  });
}

function buildPerCustomerView(data: AllocationPageData) {
  const roleMap = new Map(data.roles.map((r) => [r.id, r.name]));
  const projectMap = new Map(
    data.projects.map((p) => [p.id, { customer_id: p.customer_id, customerName: p.customerName, name: p.name }])
  );

  const ROW_KEY_SEP = "|";
  const keyFor = (consultantId: string, roleId: string | null) =>
    `${consultantId}${ROW_KEY_SEP}${roleId ?? "__none__"}`;

  const byCustomer = new Map<
    string,
    Map<string, Map<number, { id: string; hours: number; roleName: string; roleId: string | null; projectName: string }[]>>
  >();

  for (const a of data.allocations) {
    const proj = projectMap.get(a.project_id);
    if (!proj) continue;
    const customerId = proj.customer_id;
    const projectName = projectMap.get(a.project_id)?.name ?? "Unknown";
    const roleId = a.role_id ?? null;
    const roleName = roleId ? roleMap.get(roleId) ?? "Unknown" : "";
    const rowKey = keyFor(a.consultant_id, roleId);

    if (!byCustomer.has(customerId)) {
      byCustomer.set(customerId, new Map());
    }
    const byConsultantRole = byCustomer.get(customerId)!;
    if (!byConsultantRole.has(rowKey)) {
      byConsultantRole.set(rowKey, new Map());
    }
    const byWeek = byConsultantRole.get(rowKey)!;
    if (!byWeek.has(a.week)) {
      byWeek.set(a.week, []);
    }
    byWeek.get(a.week)!.push({
      id: a.id,
      hours: a.hours,
      roleName,
      roleId,
      projectName,
    });
  }

  const sortedCustomers = [...data.customers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return sortedCustomers.map((cust) => {
    const byConsultantRole = byCustomer.get(cust.id);
    const consultantRows: {
      consultantId: string;
      consultantName: string;
      roleId: string | null;
      roleName: string;
      weeks: { week: number; cells: { id: string; hours: number; roleName: string; roleId: string | null; projectName: string }[] }[];
    }[] = [];

    if (byConsultantRole) {
      const consultantMap = new Map(data.consultants.map((c) => [c.id, c]));
      const rows: { key: string; consultantId: string; roleId: string | null }[] = [];
      for (const rowKey of byConsultantRole.keys()) {
        const [consultantId, rolePart] = rowKey.split(ROW_KEY_SEP);
        const roleId = rolePart === "__none__" ? null : rolePart;
        rows.push({ key: rowKey, consultantId, roleId });
      }
      rows.sort((a, b) => {
        const nameA = consultantMap.get(a.consultantId)?.name ?? "";
        const nameB = consultantMap.get(b.consultantId)?.name ?? "";
        const nameCmp = nameA.localeCompare(nameB);
        if (nameCmp !== 0) return nameCmp;
        const roleA = a.roleId ? roleMap.get(a.roleId) ?? "" : "";
        const roleB = b.roleId ? roleMap.get(b.roleId) ?? "" : "";
        return roleA.localeCompare(roleB);
      });
      for (const { key: rowKey, consultantId, roleId } of rows) {
        const c = consultantMap.get(consultantId);
        const byWeek = byConsultantRole.get(rowKey);
        const weeks = data.weeks.map((w) => ({
          week: w.week,
          cells: byWeek?.get(w.week) ?? [],
        }));
        consultantRows.push({
          consultantId,
          consultantName: c?.name ?? "Unknown",
          roleId,
          roleName: roleId ? roleMap.get(roleId) ?? "Unknown" : "",
          weeks,
        });
      }
    }

    const totalByWeek = new Map<number, number>();
    for (const cr of consultantRows) {
      for (const { week, cells } of cr.weeks) {
        const sum = cells.reduce((s, x) => s + x.hours, 0);
        if (sum > 0) {
          totalByWeek.set(week, (totalByWeek.get(week) ?? 0) + sum);
        }
      }
    }

    return {
      customer: cust,
      consultantRows,
      totalByWeek,
    };
  });
}

function formatWeekLabel(week: number, year: number) {
  return `v${week} ${year}`;
}

function getAllocationCellBgClass(pct: number): string {
  if (pct === 0) return "bg-bg-muted/20";
  if (pct < 85) return "bg-warning/15";
  if (pct <= 115) return "bg-success/15";
  return "bg-danger/15";
}

export function AllocationPageClient({
  data,
  error,
  year,
  weekFrom,
  weekTo,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"consultant" | "customer">(
    "consultant"
  );
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addInitialParams, setAddInitialParams] = useState<{
    consultantId: string;
    consultantName?: string;
    week: number;
    year: number;
  } | null>(null);
  const [editingAllocation, setEditingAllocation] = useState<{
    id: string;
    consultantName: string;
    projectName: string;
    customerName: string;
    week: number;
    year: number;
    hours: number;
    roleId: string | null;
    roleName: string;
  } | null>(null);
  const [expandedConsultants, setExpandedConsultants] = useState<Set<string>>(
    new Set()
  );
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(
    new Set()
  );
  const [teamFilterId, setTeamFilterId] = useState<string | null>(null);

  const filteredData: AllocationPageData = {
    ...data,
    consultants: data.consultants.filter((c) => {
      if (teamFilterId !== null && c.teamId !== teamFilterId) return false;
      return true;
    }),
  };

  const handleSuccess = () => {
    router.refresh();
  };

  const SHIFT_WEEKS = 4;

  const getPreviousUrl = () => {
    const span = weekTo - weekFrom + 1;
    if (weekFrom > SHIFT_WEEKS) {
      const newFrom = weekFrom - SHIFT_WEEKS;
      const newTo = weekTo - SHIFT_WEEKS;
      return `/allocation?year=${year}&from=${newFrom}&to=${newTo}`;
    }
    const newYear = year - 1;
    const newTo = 52 - (SHIFT_WEEKS - weekFrom);
    const newFrom = Math.max(1, newTo - span + 1);
    return `/allocation?year=${newYear}&from=${newFrom}&to=${newTo}`;
  };

  const getNextUrl = () => {
    const span = weekTo - weekFrom + 1;
    if (weekTo <= 52 - SHIFT_WEEKS) {
      const newFrom = weekFrom + SHIFT_WEEKS;
      const newTo = weekTo + SHIFT_WEEKS;
      return `/allocation?year=${year}&from=${newFrom}&to=${newTo}`;
    }
    const newYear = year + 1;
    const newFrom = weekTo - (52 - SHIFT_WEEKS);
    const newTo = Math.min(52, newFrom + span - 1);
    return `/allocation?year=${newYear}&from=${newFrom}&to=${newTo}`;
  };

  const goToPreviousWeeks = () => router.push(getPreviousUrl());
  const goToNextWeeks = () => router.push(getNextUrl());

  const toggleConsultant = (id: string) => {
    setExpandedConsultants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCustomer = (id: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Allocation</h1>
        <p className="mt-4 text-danger">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="mb-6 h-8 w-48 animate-pulse rounded bg-bg-muted" />
        <div className="mb-4 h-4 w-64 animate-pulse rounded bg-bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-bg-default" />
      </div>
    );
  }

  const perConsultant = buildPerConsultantView(filteredData);
  const perCustomer = buildPerCustomerView(filteredData);
  const perConsultantInternal = perConsultant.filter((r) => !r.consultant.isExternal);
  const perConsultantExternal = perConsultant.filter((r) => r.consultant.isExternal);
  const { week: currentWeek, year: currentYear } = getCurrentYearWeek();
  const monthSpans = getMonthSpansForWeeks(data.weeks);
  const isCurrentWeek = (w: { year: number; week: number }) =>
    w.year === currentYear && w.week === currentWeek;

  return (
    <>
      <PageHeader
        title="Allocation"
        description="Manage allocations per week"
        className="mb-6"
      >
        <Button
          onClick={() => {
            setAddInitialParams(null);
            setAddModalOpen(true);
          }}
          className="self-start"
        >
          <Plus className="h-4 w-4" />
          Add allocation
        </Button>
      </PageHeader>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "consultant" | "customer")}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="consultant">Per consultant</TabsTrigger>
          <TabsTrigger value="customer">Per customer</TabsTrigger>
        </TabsList>
      </Tabs>

      {data.teams.length > 0 && (
        <div className="mb-3 w-fit px-2">
          <Select
            value={teamFilterId ?? ""}
            onValueChange={(v) => setTeamFilterId(v ? v : null)}
            options={[
              { value: "", label: "All teams" },
              ...data.teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
            size="sm"
            className="w-auto min-w-[120px]"
          />
        </div>
      )}

      <div className="overflow-x-auto space-y-8">
          {activeTab === "consultant" && (
            <>
              <div className="p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-text-primary opacity-60">
                    Interna
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums text-text-primary opacity-70">
                      {year} · v{weekFrom}–v{weekTo}
                    </span>
                    <button
                      type="button"
                      onClick={goToPreviousWeeks}
                      onMouseEnter={() => router.prefetch(getPreviousUrl())}
                      className="rounded p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
                      aria-label="Previous weeks"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextWeeks}
                      onMouseEnter={() => router.prefetch(getNextUrl())}
                      className="rounded p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
                      aria-label="Next weeks"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
                  <colgroup>
                    <col className="w-[180px]" />
                    {data.weeks.map((w) => (
                      <col key={`${w.year}-${w.week}`} className="w-[1.75rem]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-grid-subtle bg-bg-muted/80">
                      <th
                        rowSpan={2}
                        className="border-r border-grid-subtle px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
                      >
                        Consultant / Project
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
                    </tr>
                    <tr className="border-b border-grid-subtle bg-bg-muted">
                      {data.weeks.map((w) => (
                        <th
                          key={`${w.year}-${w.week}`}
                          className={`border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-80 ${isCurrentWeek(w) ? "bg-brand-lilac/30 border-l-2 border-r-2 border-brand-signal/40" : ""}`}
                        >
                          v{w.week}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perConsultantInternal.map((row) => {
                const expanded = expandedConsultants.has(row.consultant.id);
                const hasProjects = row.projectRows.length > 0;
                return (
                  <Fragment key={row.consultant.id}>
                    <tr className="border-b border-grid-light-subtle last:border-border">
                      <td className="border-r border-grid-light-subtle px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            hasProjects && toggleConsultant(row.consultant.id)
                          }
                          className="flex items-center gap-1 text-left"
                        >
                          {hasProjects ? (
                            expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )
                          ) : (
                            <span className="w-4" />
                          )}
                          <span className="font-medium text-text-primary">
                            {row.consultant.name}
                            {row.consultant.teamName && (
                              <span className="ml-2 text-text-primary opacity-60">
                                ({row.consultant.teamName})
                              </span>
                            )}
                            {row.consultant.isExternal && (
                              <span className="ml-1.5 rounded bg-brand-blue/60 px-1 py-0.5 text-[10px] text-text-primary">
                                External
                              </span>
                            )}
                          </span>
                        </button>
                      </td>
                      {row.percentByWeek.map((pct, i) => {
                        const details = row.percentDetailsByWeek?.[i];
                        const isOverallocated = pct > 115;
                        const title =
                          details && pct > 0
                            ? `${details.total}h of ${details.available}h (${pct}%)`
                            : undefined;
                        const hasBooking = pct > 0;
                        const w = data.weeks[i];
                        return (
                          <td
                            key={i}
                            className={`${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center ${getAllocationCellBgClass(pct)} ${isCurrentWeek(w) ? "border-l-2 border-r-2 border-brand-signal/40" : ""} cursor-pointer hover:bg-bg-muted/50`}
                            title={title}
                            onClick={() => {
                              setAddInitialParams({
                                consultantId: row.consultant.id,
                                consultantName: row.consultant.name,
                                week: w.week,
                                year: w.year,
                              });
                              setAddModalOpen(true);
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
                    </tr>
                    {expanded &&
                      row.projectRows.map((pr) => (
                        <tr
                          key={pr.projectId}
                          className="border-b border-grid-light-subtle last:border-border"
                          style={{
                            backgroundColor: `${pr.customerColor}18`,
                          }}
                        >
                          <td className="border-r border-grid-light-subtle px-2 py-1 pl-8 text-[10px] text-text-primary">
                            {pr.projectName} ({pr.customerName})
                            {(pr.roleName || row.consultant.defaultRoleName) && (
                              <span className="ml-2 text-text-primary opacity-70">
                                · {pr.roleName || row.consultant.defaultRoleName}
                              </span>
                            )}
                          </td>
                          {pr.weeks.map((w, i) => {
                            const hasBooking = w.cell && w.cell.hours > 0;
                            const isCurrent = isCurrentWeek(data.weeks[i]);
                            return (
                            <td
                              key={i}
                              className={`${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center ${isCurrentWeek(data.weeks[i]) ? "border-l-2 border-r-2 border-brand-signal/40" : ""} cursor-pointer hover:opacity-80`}
                              onClick={
                                hasBooking
                                  ? () =>
                                      setEditingAllocation({
                                        id: w.cell!.id,
                                        consultantName: row.consultant.name,
                                        projectName: pr.projectName,
                                        customerName: pr.customerName,
                                        week: w.week,
                                        year: data.year,
                                        hours: w.cell!.hours,
                                        roleId: w.cell!.roleId,
                                        roleName: w.cell!.roleName,
                                      })
                                  : () => {
                                      setAddInitialParams({
                                        consultantId: row.consultant.id,
                                        consultantName: row.consultant.name,
                                        week: w.week,
                                        year: data.weeks[i].year,
                                      });
                                      setAddModalOpen(true);
                                    }
                              }
                            >
                              {hasBooking ? (
                                <span>{w.cell!.hours}h</span>
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
              <div className="p-2">
                <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-text-primary opacity-60">
                  Externa
                </h3>
                <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
                  <colgroup>
                    <col className="w-[180px]" />
                    {data.weeks.map((w) => (
                      <col key={`ext-${w.year}-${w.week}`} className="w-[1.75rem]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-grid-subtle bg-bg-muted/80">
                      <th
                        rowSpan={2}
                        className="border-r border-grid-subtle px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
                      >
                        Consultant / Project
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
                    </tr>
                    <tr className="border-b border-grid-subtle bg-bg-muted">
                      {data.weeks.map((w) => (
                        <th
                          key={`${w.year}-${w.week}`}
                          className={`border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-80 ${isCurrentWeek(w) ? "bg-brand-lilac/30 border-l-2 border-r-2 border-brand-signal/40" : ""}`}
                        >
                          v{w.week}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perConsultantExternal.map((row) => {
                const expanded = expandedConsultants.has(row.consultant.id);
                const hasProjects = row.projectRows.length > 0;
                return (
                  <Fragment key={row.consultant.id}>
                    <tr className="border-b border-grid-light-subtle last:border-border">
                      <td className="border-r border-grid-light-subtle px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            hasProjects && toggleConsultant(row.consultant.id)
                          }
                          className="flex items-center gap-1 text-left"
                        >
                          {hasProjects ? (
                            expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )
                          ) : (
                            <span className="w-4" />
                          )}
                          <span className="font-medium text-text-primary">
                            {row.consultant.name}
                            {row.consultant.teamName && (
                              <span className="ml-2 text-text-primary opacity-60">
                                ({row.consultant.teamName})
                              </span>
                            )}
                            <span className="ml-1.5 rounded bg-brand-blue/60 px-1 py-0.5 text-[10px] text-text-primary">
                              External
                            </span>
                          </span>
                          {expanded && hasProjects && (
                            <span
                              className={
                                Math.max(
                                  ...row.percentByWeek.filter((p) => p > 0),
                                  0
                                ) > 115
                                  ? "font-medium text-danger"
                                  : "text-text-primary opacity-60"
                              }
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
                      </td>
                      {row.percentByWeek.map((pct, i) => {
                        const details = row.percentDetailsByWeek?.[i];
                        const isOverallocated = pct > 115;
                        const title =
                          details && pct > 0
                            ? `${details.total}h of ${details.available}h (${pct}%)`
                            : undefined;
                        const hasBooking = pct > 0;
                        const w = data.weeks[i];
                        return (
                          <td
                            key={i}
                            className={`${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center ${getAllocationCellBgClass(pct)} ${isCurrentWeek(w) ? "border-l-2 border-r-2 border-brand-signal/40" : ""} cursor-pointer hover:bg-bg-muted/50`}
                            title={title}
                            onClick={() => {
                              setAddInitialParams({
                                consultantId: row.consultant.id,
                                consultantName: row.consultant.name,
                                week: w.week,
                                year: w.year,
                              });
                              setAddModalOpen(true);
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
                    </tr>
                    {expanded &&
                      row.projectRows.map((pr) => (
                        <tr
                          key={pr.projectId}
                          className="border-b border-grid-light-subtle last:border-border"
                          style={{
                            backgroundColor: `${pr.customerColor}18`,
                          }}
                        >
                          <td className="border-r border-grid-light-subtle px-2 py-1 pl-8 text-[10px] text-text-primary">
                            {pr.projectName} ({pr.customerName})
                            {(pr.roleName || row.consultant.defaultRoleName) && (
                              <span className="ml-2 text-text-primary opacity-70">
                                · {pr.roleName || row.consultant.defaultRoleName}
                              </span>
                            )}
                          </td>
                          {pr.weeks.map((w, i) => {
                            const hasBooking = w.cell && w.cell.hours > 0;
                            const isCurrent = isCurrentWeek(data.weeks[i]);
                            return (
                            <td
                              key={i}
                              className={`${hasBooking ? "border-r border-grid-light-subtle" : ""} px-1 py-1 text-center ${isCurrentWeek(data.weeks[i]) ? "border-l-2 border-r-2 border-brand-signal/40" : ""} cursor-pointer hover:opacity-80`}
                              onClick={
                                hasBooking
                                  ? () =>
                                      setEditingAllocation({
                                        id: w.cell!.id,
                                        consultantName: row.consultant.name,
                                        projectName: pr.projectName,
                                        customerName: pr.customerName,
                                        week: w.week,
                                        year: data.year,
                                        hours: w.cell!.hours,
                                        roleId: w.cell!.roleId,
                                        roleName: w.cell!.roleName,
                                      })
                                  : () => {
                                      setAddInitialParams({
                                        consultantId: row.consultant.id,
                                        consultantName: row.consultant.name,
                                        week: w.week,
                                        year: data.weeks[i].year,
                                      });
                                      setAddModalOpen(true);
                                    }
                              }
                            >
                              {hasBooking ? (
                                <span>{w.cell!.hours}h</span>
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
            </>
          )}
          {activeTab === "customer" && (
            <div className="p-2">
              <div className="mb-2 flex items-center justify-end gap-2 px-1">
                <span className="text-[10px] tabular-nums text-text-primary opacity-70">
                  {year} · v{weekFrom}–v{weekTo}
                </span>
                <button
                  type="button"
                  onClick={goToPreviousWeeks}
                  onMouseEnter={() => router.prefetch(getPreviousUrl())}
                  className="rounded p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
                  aria-label="Previous weeks"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={goToNextWeeks}
                  onMouseEnter={() => router.prefetch(getNextUrl())}
                  className="rounded p-1 text-text-primary opacity-80 hover:bg-bg-muted hover:opacity-100"
                  aria-label="Next weeks"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <table className="w-full min-w-0 table-fixed border border-border text-[10px]">
              <colgroup>
                <col className="w-[180px]" />
                {data.weeks.map((w) => (
                  <col key={`${w.year}-${w.week}`} className="w-[1.75rem]" />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-grid">
                  <th
                    rowSpan={2}
                    className="border-r border-grid px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80"
                  >
                    Customer / Consultant
                  </th>
                  {monthSpans.map((span, i) => (
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
                  {data.weeks.map((w) => (
                    <th
                      key={`${w.year}-${w.week}`}
                      className={`border-r border-grid px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-80 ${isCurrentWeek(w) ? "border-l-2 border-r-2 border-brand-signal/40" : ""}`}
                    >
                      v{w.week}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perCustomer.map((row) => {
                const expanded = expandedCustomers.has(row.customer.id);
                const hasConsultants = row.consultantRows.length > 0;
                return (
                  <Fragment key={row.customer.id}>
                    <tr className="border-b border-grid-light last:border-border bg-bg-muted/60">
                      <td className="border-r border-grid-light px-2 py-1">
                        <button
                          type="button"
                          onClick={() =>
                            hasConsultants &&
                            toggleCustomer(row.customer.id)
                          }
                          className="flex items-center gap-1 text-left"
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
                        const total = row.totalByWeek.get(w.week) ?? 0;
                        const hasBooking = total > 0;
                        return (
                          <td
                            key={w.week}
                            className={`${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center text-text-primary ${isCurrentWeek(data.weeks[i]) ? "border-l-2 border-r-2 border-brand-signal/40" : ""}`}
                          >
                            {hasBooking ? `${total}h` : null}
                          </td>
                        );
                      })}
                    </tr>
                    {expanded &&
                      row.consultantRows.map((cr) => (
                          <tr
                            key={`${cr.consultantId}-${cr.roleId ?? "none"}`}
                            className="border-b border-grid-light last:border-border bg-bg-default"
                          >
                            <td className="border-r border-grid-light px-2 py-1 pl-8 text-[10px]">
                              <span className="font-normal text-text-primary">
                                {cr.consultantName}
                                {cr.roleName ? (
                                  <span className="opacity-80"> · {cr.roleName}</span>
                                ) : null}
                              </span>
                            </td>
                            {cr.weeks.map((w, i) => {
                              const cells = w.cells;
                              const totalHours = cells.reduce(
                                (s, x) => s + x.hours,
                                0
                              );
                              const hasBooking = totalHours > 0;
                              const weekInfo = data.weeks[i];
                              return (
                                <td
                                  key={i}
                                  className={`${hasBooking ? "border-r border-grid-light" : ""} px-1 py-1 text-center ${isCurrentWeek(weekInfo) ? "border-l-2 border-r-2 border-brand-signal/40" : ""} cursor-pointer hover:bg-bg-muted/50`}
                                  onClick={
                                    !hasBooking
                                      ? () => {
                                          setAddInitialParams({
                                            consultantId: cr.consultantId,
                                            consultantName: cr.consultantName,
                                            week: w.week,
                                            year: weekInfo.year,
                                          });
                                          setAddModalOpen(true);
                                        }
                                      : undefined
                                  }
                                >
                                  {hasBooking ? (
                                    <>
                                      {cells.map((cell) => (
                                        <button
                                          key={cell.id}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAllocation({
                                              id: cell.id,
                                              consultantName: cr.consultantName,
                                              projectName: cell.projectName,
                                              customerName: row.customer.name,
                                              week: w.week,
                                              year: data.year,
                                              hours: cell.hours,
                                              roleId: cell.roleId,
                                              roleName: cell.roleName,
                                            });
                                          }}
                                          className="mr-1 rounded-md px-1.5 py-0.5 text-text-primary hover:opacity-90"
                                        >
                                          {cell.hours}h
                                        </button>
                                      ))}
                                    </>
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
          )}
      </div>

      <AddAllocationModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddInitialParams(null);
        }}
        onSuccess={handleSuccess}
        year={year}
        weekFrom={weekFrom}
        weekTo={weekTo}
        initialConsultantId={addInitialParams?.consultantId}
        initialConsultantName={addInitialParams?.consultantName}
        initialWeek={addInitialParams?.week}
        initialYear={addInitialParams?.year}
      />

      <EditAllocationModal
        allocation={editingAllocation}
        isOpen={editingAllocation !== null}
        onClose={() => setEditingAllocation(null)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
