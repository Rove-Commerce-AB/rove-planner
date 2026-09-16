import { describe, expect, it } from "vitest";
import { TO_PLAN_CONSULTANT_ID } from "./allocationPageTypes";
import type { AllocationConsultant, AllocationPageData } from "./allocationPageTypes";
import {
  consultantMatchesAllocationFilters,
  filterAllocationPageData,
} from "./allocationPageFilter";

function consultant(
  overrides: Partial<AllocationConsultant> & Pick<AllocationConsultant, "id" | "name">
): AllocationConsultant {
  return {
    initials: overrides.name.slice(0, 2).toUpperCase(),
    hoursPerWeek: 40,
    defaultRoleName: "Developer",
    defaultRoleId: "role-dev",
    teamId: null,
    teamName: null,
    isExternal: false,
    availableHoursByWeek: [40],
    unavailableByWeek: [false],
    ...overrides,
  };
}

const kamil = consultant({
  id: "kamil",
  name: "Kamil",
  teamId: "poland",
  teamName: "Team Poland",
});
const anna = consultant({
  id: "anna",
  name: "Anna",
  teamId: "poland",
  teamName: "Team Poland",
});
const erik = consultant({
  id: "erik",
  name: "Erik",
  teamId: "sweden",
  teamName: "Team Sweden",
});
const toPlan = consultant({
  id: TO_PLAN_CONSULTANT_ID,
  name: "To plan",
  defaultRoleName: "",
  defaultRoleId: null,
});

describe("consultantMatchesAllocationFilters", () => {
  it("on the full allocation page, team filter shows every member of that team", () => {
    expect(
      consultantMatchesAllocationFilters(kamil, "poland", null)
    ).toBe(true);
    expect(
      consultantMatchesAllocationFilters(anna, "poland", null)
    ).toBe(true);
    expect(
      consultantMatchesAllocationFilters(erik, "poland", null)
    ).toBe(false);
  });

  it("in project planning, All teams keeps the customer-linked subset", () => {
    const visible = ["kamil"];
    expect(
      consultantMatchesAllocationFilters(kamil, null, null, visible)
    ).toBe(true);
    expect(
      consultantMatchesAllocationFilters(anna, null, null, visible)
    ).toBe(false);
  });

  it("in project planning, choosing a team shows all members of that team", () => {
    const visible = ["kamil"];
    expect(
      consultantMatchesAllocationFilters(kamil, "poland", null, visible)
    ).toBe(true);
    expect(
      consultantMatchesAllocationFilters(anna, "poland", null, visible)
    ).toBe(true);
    expect(
      consultantMatchesAllocationFilters(erik, "poland", null, visible)
    ).toBe(false);
  });
});

describe("filterAllocationPageData", () => {
  const data: AllocationPageData = {
    consultants: [toPlan, kamil, anna, erik],
    projects: [],
    customers: [],
    roles: [],
    teams: [
      { id: "poland", name: "Team Poland" },
      { id: "sweden", name: "Team Sweden" },
    ],
    allocations: [],
    year: 2026,
    weekFrom: 1,
    weekTo: 8,
    weeks: [],
    consultantTotalHours: { kamil: 12 },
    defaultVisibleConsultantIds: ["kamil"],
  };

  it("keeps extra page fields and shows the whole team when a team is selected", () => {
    const filtered = filterAllocationPageData(data, "poland", null);
    expect(filtered.consultants.map((c) => c.id)).toEqual(["kamil", "anna"]);
    expect(filtered.consultantTotalHours).toEqual({ kamil: 12 });
    expect(filtered.defaultVisibleConsultantIds).toEqual(["kamil"]);
  });

  it("without a team filter, only customer-linked consultants are listed", () => {
    const filtered = filterAllocationPageData(data, null, null);
    expect(filtered.consultants.map((c) => c.id)).toEqual(["kamil"]);
  });
});
