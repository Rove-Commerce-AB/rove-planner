/** Canonical app routes for Rove Apps. Keep sidebar, redirects, and revalidation in sync. */
export const ROUTES = {
  home: "/",
  allocation: "/planner/allocation",
  timeReport: "/time-report/time-report",
  timeApproval: "/time-report/approval",
  insights: "/insights",
  settings: "/settings/general",
  consultants: "/settings/consultants",
  customers: "/settings/customers",
  notifications: "/notifications",
} as const;

export function allocationHref(params: {
  year: number;
  from: number;
  to: number;
}): string {
  return `${ROUTES.allocation}?year=${params.year}&from=${params.from}&to=${params.to}`;
}

export function customerHref(id: string): string {
  return `${ROUTES.customers}/${id}`;
}

export function consultantHref(id: string): string {
  return `${ROUTES.consultants}/${id}`;
}
