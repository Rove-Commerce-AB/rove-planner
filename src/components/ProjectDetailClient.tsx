"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  updateProject,
  deleteProject,
  getUniqueJiraAndDevopsProjects,
  type IntegrationProjectOption,
} from "@/lib/projects";
import { getCustomers } from "@/lib/customers";
import { getProjectAllocationData } from "@/app/(app)/allocation/actions";
import type { ProjectWithDetails, ProjectType } from "@/types";
import type { AllocationPageData } from "@/lib/allocationPage";
import {
  ConfirmModal,
  Dialog,
  Select,
  Button,
  DetailPageHeader,
  Panel,
  Input,
} from "@/components/ui";
import { moveEntireBookingAction } from "@/app/(app)/projects/[id]/actions";
import { ProjectRatesTab } from "./ProjectRatesTab";

const AllocationPageClient = dynamic(
  () =>
    import("./AllocationPageClient").then((m) => ({
      default: m.AllocationPageClient,
    })),
  { ssr: false }
);

const tableBorder = "border-panel";

const PROBABILITY_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
type EditField =
  | "name"
  | "customerId"
  | "integration"
  | "budgetHours"
  | "budgetMoney"
  | "startDate"
  | "endDate"
  | "probability"
  | null;

type Props = {
  project: ProjectWithDetails;
  allocationData: AllocationPageData | null;
  allocationError: string | null;
  allocationYear: number;
  allocationWeekFrom: number;
  allocationWeekTo: number;
  currentYear: number;
  currentWeek: number;
  /** Role ID -> rate per hour (SEK) for planning panel revenue row. */
  allocationRates?: Record<string, number>;
};

export function ProjectDetailClient({
  project: initial,
  allocationData,
  allocationError,
  allocationYear,
  allocationWeekFrom,
  allocationWeekTo,
  currentYear,
  currentWeek,
  allocationRates,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [customerId, setCustomerId] = useState(initial.customer_id);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [type, setType] = useState<ProjectType>(initial.type);
  const [startDate, setStartDate] = useState(initial.startDate ?? "");
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [probability, setProbability] = useState(initial.probability ?? 100);
  const [budgetHours, setBudgetHours] = useState<number | null>(
    initial.budgetHours != null ? Number(initial.budgetHours) : null
  );
  const [budgetMoney, setBudgetMoney] = useState<number | null>(
    initial.budgetMoney != null ? Number(initial.budgetMoney) : null
  );
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [integrationOptions, setIntegrationOptions] = useState<
    IntegrationProjectOption[]
  >([]);
  const [planningData, setPlanningData] = useState<AllocationPageData | null>(allocationData);
  const [planningError, setPlanningError] = useState<string | null>(allocationError);
  const [planningYear, setPlanningYear] = useState(allocationYear);
  const [planningWeekFrom, setPlanningWeekFrom] = useState(allocationWeekFrom);
  const [planningWeekTo, setPlanningWeekTo] = useState(allocationWeekTo);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [showMoveBookingModal, setShowMoveBookingModal] = useState(false);
  const [moveWeeks, setMoveWeeks] = useState("1");
  const [moveForward, setMoveForward] = useState(true);
  const [moveBookingError, setMoveBookingError] = useState<string | null>(null);
  const [moveBookingSubmitting, setMoveBookingSubmitting] = useState(false);

  useEffect(() => {
    setPlanningData(allocationData);
    setPlanningError(allocationError);
    setPlanningYear(allocationYear);
    setPlanningWeekFrom(allocationWeekFrom);
    setPlanningWeekTo(allocationWeekTo);
  }, [allocationData, allocationError, allocationYear, allocationWeekFrom, allocationWeekTo]);

  const handleWeekRangeChange = useCallback(
    async (year: number, weekFrom: number, weekTo: number) => {
      setPlanningLoading(true);
      try {
        const { data, error } = await getProjectAllocationData(
          initial.id,
          initial.customer_id ?? "",
          year,
          weekFrom,
          weekTo
        );
        setPlanningData(data);
        setPlanningError(error);
        setPlanningYear(year);
        setPlanningWeekFrom(weekFrom);
        setPlanningWeekTo(weekTo);
        const q = `year=${year}&from=${weekFrom}&to=${weekTo}`;
        router.replace(`/projects/${initial.id}?${q}`, { scroll: false });
      } finally {
        setPlanningLoading(false);
      }
    },
    [initial.id, initial.customer_id, router]
  );

  const syncFromInitial = useCallback(() => {
    setName(initial.name);
    setCustomerId(initial.customer_id);
    setIsActive(initial.isActive);
    setType(initial.type);
    setStartDate(initial.startDate ?? "");
    setEndDate(initial.endDate ?? "");
    setProbability(initial.probability ?? 100);
    setBudgetHours(initial.budgetHours != null ? Number(initial.budgetHours) : null);
    setBudgetMoney(initial.budgetMoney != null ? Number(initial.budgetMoney) : null);
  }, [initial]);

  useEffect(() => {
    syncFromInitial();
  }, [syncFromInitial]);

  useEffect(() => {
    getCustomers()
      .then((c) => setCustomers(c))
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    getUniqueJiraAndDevopsProjects()
      .then(setIntegrationOptions)
      .catch(() => setIntegrationOptions([{ value: "", label: "—" }]));
  }, []);

  const saveField = async (field: EditField, value: string) => {
    if (field == null) return;
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = value.trim();
      switch (field) {
        case "name":
          if (!trimmed) {
            setError("Project name is required");
            setSubmitting(false);
            return;
          }
          await updateProject(initial.id, { name: trimmed });
          setName(trimmed);
          break;
        case "customerId":
          if (!trimmed) {
            setError("Customer is required");
            setSubmitting(false);
            return;
          }
          await updateProject(initial.id, { customer_id: trimmed });
          setCustomerId(trimmed);
          break;
        case "startDate":
          await updateProject(initial.id, {
            start_date: trimmed || null,
          });
          setStartDate(trimmed || "");
          break;
        case "endDate":
          await updateProject(initial.id, {
            end_date: trimmed || null,
          });
          setEndDate(trimmed || "");
          break;
        case "probability": {
          const num = parseInt(trimmed, 10);
          if (Number.isNaN(num) || num < 10 || num > 100 || num % 10 !== 0) {
            setError("Probability must be 10, 20, … 100");
            setSubmitting(false);
            return;
          }
          await updateProject(initial.id, { probability: num });
          setProbability(num);
          break;
        }
        case "integration": {
          if (trimmed === "") {
            await updateProject(initial.id, {
              jira_project_key: null,
              devops_project: null,
            });
          } else if (trimmed.startsWith("jira:")) {
            await updateProject(initial.id, {
              jira_project_key: trimmed.slice(5),
              devops_project: null,
            });
          } else if (trimmed.startsWith("devops:")) {
            await updateProject(initial.id, {
              jira_project_key: null,
              devops_project: trimmed.slice(7),
            });
          }
          break;
        }
        case "budgetHours": {
          const num = trimmed === "" ? null : parseInt(trimmed, 10);
          if (trimmed !== "" && (num === null || Number.isNaN(num) || num < 0)) {
            setError("Enter a positive integer or leave empty");
            setSubmitting(false);
            return;
          }
          await updateProject(initial.id, { budget_hours: num ?? null });
          setBudgetHours(num ?? null);
          break;
        }
        case "budgetMoney": {
          const num = trimmed === "" ? null : parseInt(trimmed, 10);
          if (trimmed !== "" && (num === null || Number.isNaN(num) || num < 0)) {
            setError("Enter a positive integer (SEK) or leave empty");
            setSubmitting(false);
            return;
          }
          await updateProject(initial.id, { budget_money: num ?? null });
          setBudgetMoney(num ?? null);
          break;
        }
        default:
          break;
      }
      router.refresh();
      setEditingField(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setError(null);
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteProject(initial.id);
      setShowDeleteConfirm(false);
      router.push("/projects");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await updateProject(initial.id, { is_active: !isActive });
      setIsActive(!isActive);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const PROJECT_TYPES: ProjectType[] = ["customer", "internal", "absence"];
  const TYPE_LABELS: Record<ProjectType, string> = {
    customer: "Customer project",
    internal: "Internal project",
    absence: "Absence",
  };

  const cycleType = async () => {
    const idx = PROJECT_TYPES.indexOf(type);
    const next = PROJECT_TYPES[(idx + 1) % PROJECT_TYPES.length];
    setError(null);
    setSubmitting(true);
    try {
      await updateProject(initial.id, { type: next });
      setType(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weeks = Math.max(1, Math.floor(Number(moveWeeks.replace(",", ".")) || 1));
    const delta = moveForward ? weeks : -weeks;
    setMoveBookingError(null);
    setMoveBookingSubmitting(true);
    try {
      const result = await moveEntireBookingAction(initial.id, delta);
      if (result.ok) {
        setShowMoveBookingModal(false);
        setMoveWeeks("1");
        setMoveForward(true);
        router.refresh();
        if (planningData) {
          setPlanningLoading(true);
          const { data, error } = await getProjectAllocationData(
            initial.id,
            initial.customer_id ?? "",
            planningYear,
            planningWeekFrom,
            planningWeekTo
          );
          setPlanningData(data);
          setPlanningError(error);
          setPlanningLoading(false);
        }
      } else {
        setMoveBookingError(result.error ?? "Failed to move");
      }
    } finally {
      setMoveBookingSubmitting(false);
    }
  };

  const projectInitials = initial.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const customerOptions = (() => {
    const base = customers.map((c) => ({ value: c.id, label: c.name }));
    if (
      customerId &&
      initial.customerName &&
      !customers.some((c) => c.id === customerId)
    ) {
      return [{ value: customerId, label: initial.customerName }, ...base];
    }
    return base;
  })();

  const labelClass =
    "text-xs font-medium uppercase tracking-wider text-text-primary opacity-70";
  const valueClass = "font-semibold text-text-primary";

  return (
    <>
      <DetailPageHeader
        backHref={`/customers/${initial.customer_id}`}
        backLabel={`Back to ${initial.customerName ?? "Customer"}`}
        avatar={
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ backgroundColor: initial.color }}
            aria-hidden
          >
            <span className="text-xs font-semibold text-text-inverse">
              {projectInitials}
            </span>
          </div>
        }
        title={name}
        subtitle={initial.customerName}
        action={
          <Button
            variant="secondary"
            className="border-danger text-danger hover:bg-danger/10"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={submitting || deleting}
          >
            Delete Project
          </Button>
        }
      />

      {error && (
        <p className="mb-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* INFORMATION */}
        <Panel>
          <h2
            className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}
          >
            INFORMATION
          </h2>
          <div className="space-y-6 p-5">
            <div>
              <div className={labelClass}>Project name</div>
              {editingField === "name" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-w-[120px] flex-1 rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    placeholder="Website redesign"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("name", editValue)}
                    disabled={submitting || !editValue.trim()}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cursor-pointer mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(name);
                    setEditingField("name");
                  }}
                >
                  {name}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Customer</div>
              {editingField === "customerId" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={customerOptions}
                    placeholder="Select customer"
                    className="min-w-[180px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("customerId", editValue)}
                    disabled={submitting || !editValue}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cursor-pointer mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(customerId);
                    setEditingField("customerId");
                  }}
                >
                  {initial.customerName ?? "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Jira / DevOps project</div>
              {editingField === "integration" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={integrationOptions}
                    placeholder="Select project"
                    className="min-w-[220px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("integration", editValue)}
                    disabled={submitting}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cursor-pointer mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    const val = initial.jiraProjectKey
                      ? `jira:${initial.jiraProjectKey}`
                      : initial.devopsProject
                        ? `devops:${initial.devopsProject}`
                        : "";
                    setEditValue(val);
                    setEditingField("integration");
                  }}
                >
                  {initial.jiraProjectKey
                    ? `Jira: ${initial.jiraProjectKey}`
                    : initial.devopsProject
                      ? `DevOps: ${initial.devopsProject}`
                      : "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Budget (hours)</div>
              {editingField === "budgetHours" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="—"
                    className="min-w-[100px] rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("budgetHours", editValue)}
                    disabled={submitting}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cursor-pointer mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(budgetHours != null ? String(budgetHours) : "");
                    setEditingField("budgetHours");
                  }}
                >
                  {budgetHours != null ? `${budgetHours} h` : "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Budget (SEK)</div>
              {editingField === "budgetMoney" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="—"
                    className="min-w-[100px] rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("budgetMoney", editValue)}
                    disabled={submitting}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cursor-pointer mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(budgetMoney != null ? String(budgetMoney) : "");
                    setEditingField("budgetMoney");
                  }}
                >
                  {budgetMoney != null
                    ? `${String(budgetMoney).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")} SEK`
                    : "—"}
                </button>
              )}
            </div>
          </div>
        </Panel>

        {/* DATES & STATUS */}
        <Panel>
          <h2
            className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}
          >
            DATES &amp; STATUS
          </h2>
          <div className="space-y-6 p-5">
            <div>
              <div className={labelClass}>Start date</div>
              {editingField === "startDate" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-w-[140px] rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("startDate", editValue)}
                    disabled={submitting}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cursor-pointer mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(startDate);
                    setEditingField("startDate");
                  }}
                >
                  {startDate || "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>End date</div>
              {editingField === "endDate" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-w-[140px] rounded-lg border-2 border-brand-signal px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-signal"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("endDate", editValue)}
                    disabled={submitting}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cursor-pointer mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(endDate);
                    setEditingField("endDate");
                  }}
                >
                  {endDate || "—"}
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Type</div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={cycleType}
                  disabled={submitting}
                  className="cursor-pointer inline-flex rounded-full border border-[var(--color-brand-blue)] bg-brand-blue/50 px-3 py-1 text-xs font-medium text-text-primary hover:bg-brand-blue/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {TYPE_LABELS[type]}
                </button>
              </div>
            </div>

            <div>
              <div className={labelClass}>Probability</div>
              {editingField === "probability" ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select
                    value={editValue}
                    onValueChange={setEditValue}
                    options={PROBABILITY_OPTIONS.map((n) => ({
                      value: String(n),
                      label: `${n}%`,
                    }))}
                    placeholder="Select"
                    className="min-w-[100px]"
                    triggerClassName="!border-2 !border-brand-signal"
                  />
                  <Button
                    type="button"
                    onClick={() => saveField("probability", editValue)}
                    disabled={submitting || !editValue}
                  >
                    Save
                  </Button>
                  <Button variant="secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`cursor-pointer mt-1.5 block text-left ${valueClass} hover:underline`}
                  onClick={() => {
                    setEditValue(String(probability));
                    setEditingField("probability");
                  }}
                >
                  {probability}%
                </button>
              )}
            </div>

            <div>
              <div className={labelClass}>Status</div>
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={toggleActive}
                  disabled={submitting}
                  className="cursor-pointer inline-flex rounded-full border border-[var(--color-brand-blue)] bg-brand-blue/50 px-3 py-1 text-xs font-medium text-text-primary hover:bg-brand-blue/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActive ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* RATES */}
      <Panel className="mt-6">
        <h2
          className={`border-b ${tableBorder} bg-bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70`}
        >
          RATES/TASKS
        </h2>
        <div className="p-5">
          {ratesError && (
            <p className="mb-4 text-sm text-danger">{ratesError}</p>
          )}
          <ProjectRatesTab
            projectId={initial.id}
            onError={setRatesError}
            showDescription={false}
          />
        </div>
      </Panel>

      {/* PLANNING */}
      <Panel className="mt-6">
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-b ${tableBorder} bg-bg-muted/40 px-4 py-3`}
          suppressHydrationWarning
        >
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
            PLANNING
          </h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setMoveBookingError(null);
              setMoveWeeks("1");
              setMoveForward(true);
              setShowMoveBookingModal(true);
            }}
          >
            Move entire booking
          </Button>
        </div>
        <div className="p-5">
          <AllocationPageClient
            data={planningData}
            error={planningError}
            year={planningYear}
            weekFrom={planningWeekFrom}
            weekTo={planningWeekTo}
            currentYear={currentYear}
            currentWeek={currentWeek}
            embedMode={{ projectId: initial.id, rates: allocationRates, budgetHours: budgetHours ?? undefined, budgetMoney: budgetMoney ?? undefined }}
            onWeekRangeChange={handleWeekRangeChange}
            embedWeekNavLoading={planningLoading}
          />
        </div>
      </Panel>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete project"
        message={`Delete ${name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />

      <Dialog
        open={showMoveBookingModal}
        onOpenChange={(open) => {
          if (!open) setMoveBookingError(null);
          setShowMoveBookingModal(open);
        }}
        title="Move entire booking"
      >
        <form onSubmit={handleMoveBookingSubmit} className="mt-4 space-y-4">
          {moveBookingError && (
            <p className="text-sm text-danger" role="alert">
              {moveBookingError}
            </p>
          )}
          <div>
            <label
              htmlFor="move-booking-weeks"
              className="block text-sm font-medium text-text-primary"
            >
              Number of weeks
            </label>
            <Input
              id="move-booking-weeks"
              type="number"
              min={1}
              value={moveWeeks}
              onChange={(e) => setMoveWeeks(e.target.value || "1")}
              className="mt-1 w-24"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-text-primary mb-2">
              Direction
            </span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="move-direction"
                  checked={moveForward}
                  onChange={() => setMoveForward(true)}
                  className="rounded-full border-border text-brand-signal focus:ring-brand-signal"
                />
                <span className="text-text-primary">Forward</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="move-direction"
                  checked={!moveForward}
                  onChange={() => setMoveForward(false)}
                  className="rounded-full border-border text-brand-signal focus:ring-brand-signal"
                />
                <span className="text-text-primary">Backward</span>
              </label>
            </div>
          </div>
          <p className="text-xs text-text-primary opacity-70">
            All allocations for this project (all people) will be moved by the chosen number of weeks.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowMoveBookingModal(false)}
              disabled={moveBookingSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={moveBookingSubmitting}>
              {moveBookingSubmitting ? "Moving…" : "Move"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
