import type { ProjectBillingType } from "@/types";

export type { ProjectBillingType };

export const PROJECT_BILLING_TYPES = [
  "time_and_material",
  "fixed_price",
] as const satisfies readonly ProjectBillingType[];

export const DEFAULT_PROJECT_BILLING_TYPE: ProjectBillingType =
  "time_and_material";

export function isProjectBillingType(
  value: unknown
): value is ProjectBillingType {
  return (
    value === "time_and_material" || value === "fixed_price"
  );
}

export function parseProjectBillingType(value: unknown): ProjectBillingType {
  return isProjectBillingType(value) ? value : DEFAULT_PROJECT_BILLING_TYPE;
}

export function validateProjectBilling(input: {
  billingType: ProjectBillingType;
  fixedPrice: number | null | undefined;
}): string | null {
  if (input.billingType !== "fixed_price") return null;
  if (
    input.fixedPrice == null ||
    !Number.isFinite(input.fixedPrice) ||
    input.fixedPrice <= 0
  ) {
    return "Price is required for fixed-price projects";
  }
  return null;
}

/** Fixed-price projects do not bill by the hour. */
export function effectiveHourlyRate(
  billingType: ProjectBillingType,
  storedRate: number | null | undefined
): number | null {
  if (billingType === "fixed_price") return 0;
  if (storedRate == null || !Number.isFinite(storedRate)) return null;
  return storedRate;
}
