export type BillableUtilizationMonth = {
  year: number;
  month: number;
  label: string;
};

export type BillableUtilizationMonthPoint = {
  /** Billable hours reported (invoiced) in the month. */
  actualBillableHours: number;
  /** Billable hours from allocation forecast in the month. */
  forecastBillableHours: number;
  /** Total consultant capacity hours in the month (calendar × work %; no overhead adjustment). */
  monthCapacityHours: number;
  /** Actual utilization: billable reported ÷ month capacity (%). */
  actualUtilizationPct: number;
  /** Forecast utilization: billable allocated ÷ month capacity (%). */
  forecastUtilizationPct: number;
  /**
   * Budget utilization: weighted avg of per-person targets × month capacity (%).
   * Null when no consultants have utilization_target_pct set.
   */
  budgetUtilizationPct: number | null;
  /** Reported revenue from time entries (SEK or customer currency mix; view uses rate snapshot). */
  actualRevenue: number;
  /** Planned revenue from allocations. */
  forecastRevenue: number;
  currency: string;
};

export type BillableUtilizationMonthlyReportResult = {
  months: BillableUtilizationMonth[];
  points: BillableUtilizationMonthPoint[];
};
