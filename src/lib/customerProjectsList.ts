import type { CustomerProjectSummary } from "@/types";

const svCollator = new Intl.Collator("sv", { sensitivity: "base" });

/** null is treated as 100%, matching the rest of the app. */
export function effectiveProjectProbability(
  probability: number | null
): number {
  return probability != null ? probability : 100;
}

export function compareProjectNamesSv(a: string, b: string): number {
  return svCollator.compare(a, b);
}

export type GroupedCustomerProjects = {
  confirmed: CustomerProjectSummary[];
  pipeline: CustomerProjectSummary[];
  inactive: CustomerProjectSummary[];
};

/**
 * Active projects split into 100% (confirmed) and below 100% (pipeline),
 * each sorted A–Ö with Swedish collation. Inactive are sorted separately.
 */
export function groupCustomerProjectsForList(
  projects: CustomerProjectSummary[]
): GroupedCustomerProjects {
  const confirmed: CustomerProjectSummary[] = [];
  const pipeline: CustomerProjectSummary[] = [];
  const inactive: CustomerProjectSummary[] = [];

  for (const p of projects) {
    if (!p.isActive) {
      inactive.push(p);
      continue;
    }
    if (effectiveProjectProbability(p.probability) === 100) {
      confirmed.push(p);
    } else {
      pipeline.push(p);
    }
  }

  confirmed.sort((a, b) => compareProjectNamesSv(a.name, b.name));
  pipeline.sort((a, b) => compareProjectNamesSv(a.name, b.name));
  inactive.sort((a, b) => compareProjectNamesSv(a.name, b.name));

  return { confirmed, pipeline, inactive };
}
