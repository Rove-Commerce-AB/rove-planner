export type AllocationBudgetProjectRow = {
  projectId: string;
  projectName: string;
  /** Sum of allocation hours in the selected weeks (all roles/consultants). */
  allocatedHours: number;
  /** Project total budget in hours, when set on the project. */
  budgetHours: number | null;
};

export type AllocationBudgetCustomerGroup = {
  customerId: string;
  customerName: string;
  allocatedHours: number;
  projects: AllocationBudgetProjectRow[];
};

export type AllocationBudgetDrilldownResult = {
  weekCount: number;
  /** Inclusive ISO week range actually queried (after normalisation). */
  range: {
    fromYear: number;
    fromWeek: number;
    toYear: number;
    toWeek: number;
  };
  customers: AllocationBudgetCustomerGroup[];
};
