import { describe, expect, it } from "vitest";
import type { WorkIssue, WorkLabel, WorkPerson } from "@/lib/workTypes";
import { emptyWorkIssueRelations } from "./workIssueRelations";
import {
  NO_LABEL_ID,
  UNASSIGNED_OWNER_ID,
  collectOwnerFilterPeople,
  columnIssueGroups,
  groupByTriggerLabel,
  groupIssuesByLabel,
  groupIssuesByOwner,
  issueMatchesOwnerFilter,
  visibleWorkIssueIds,
} from "./workBoardView";

function person(id: string, name: string): WorkPerson {
  return { id, name, initials: name.slice(0, 2).toUpperCase() };
}

function label(id: string, name: string): WorkLabel {
  return { id, name };
}

function issue(
  partial: Partial<WorkIssue> & Pick<WorkIssue, "id" | "title">
): WorkIssue {
  return {
    number: 1,
    key: "RT-1",
    status: "todo",
    sortOrder: 0,
    description: "",
    currentState: "",
    nextStep: "",
    owner: null,
    reporter: person("reporter", "Reporter"),
    assignees: [],
    labels: [],
    comments: [],
    events: [],
    files: [],
    requirements: [],
    definitionOfDone: [],
    outOfScope: "",
    references: [],
    relations: emptyWorkIssueRelations(),
    estimateHours: null,
    loggedHours: 0,
    priority: null,
    ...partial,
  };
}

const anna = person("anna", "Anna");
const simon = person("simon", "Simon");
const bug = label("bug", "Bug");
const ux = label("ux", "UX");

const issues = [
  issue({ id: "1", title: "Alpha", key: "RT-1", owner: simon, labels: [ux] }),
  issue({ id: "2", title: "Beta", key: "RT-2", owner: anna, labels: [bug, ux] }),
  issue({ id: "3", title: "Gamma", key: "RT-3", owner: null }),
];

describe("issueMatchesOwnerFilter", () => {
  it("shows every issue when no owners are selected", () => {
    expect(issues.every((row) => issueMatchesOwnerFilter(row, []))).toBe(true);
  });

  it("keeps only the selected owners, including unassigned", () => {
    expect(issueMatchesOwnerFilter(issues[0]!, [simon.id])).toBe(true);
    expect(issueMatchesOwnerFilter(issues[1]!, [simon.id])).toBe(false);
    expect(issueMatchesOwnerFilter(issues[2]!, [UNASSIGNED_OWNER_ID])).toBe(
      true
    );
  });
});

describe("visibleWorkIssueIds", () => {
  it("combines search with owner filter", () => {
    expect([...visibleWorkIssueIds(issues, "rt-2", [anna.id, simon.id])]).toEqual(
      ["2"]
    );
    expect([...visibleWorkIssueIds(issues, "Gamma", [])]).toEqual(["3"]);
  });
});

describe("collectOwnerFilterPeople", () => {
  it("includes issue owners missing from the people list", () => {
    const people = collectOwnerFilterPeople([anna], issues);
    expect(people.map((row) => row.id)).toEqual(["anna", "simon"]);
  });
});

describe("groupIssuesByOwner", () => {
  it("sorts owners by name and puts unassigned last", () => {
    const groups = groupIssuesByOwner(issues);
    expect(groups.map((group) => group.key)).toEqual([
      "anna",
      "simon",
      UNASSIGNED_OWNER_ID,
    ]);
    expect(groups[0]?.issues.map((row) => row.id)).toEqual(["2"]);
  });
});

describe("groupIssuesByLabel", () => {
  it("places an issue in every label group and unlabeled last", () => {
    const groups = groupIssuesByLabel(issues);
    expect(groups.map((group) => group.key)).toEqual([
      "bug",
      "ux",
      NO_LABEL_ID,
    ]);
    expect(groups[0]?.title).toBe("Bug");
    expect(groups[0]?.issues.map((row) => row.id)).toEqual(["2"]);
    expect(groups[1]?.issues.map((row) => row.id)).toEqual(["1", "2"]);
    expect(groups[2]?.title).toBe("No labels");
  });
});

describe("columnIssueGroups", () => {
  it("returns a single unlabeled group when grouping is off", () => {
    expect(columnIssueGroups(issues, "none")).toEqual([
      { key: "all", title: "", owner: null, issues },
    ]);
  });

  it("names the group trigger after the active field", () => {
    expect(groupByTriggerLabel("none")).toBe("Group");
    expect(groupByTriggerLabel("owner")).toBe("Owner");
    expect(groupByTriggerLabel("label")).toBe("Label");
  });
});
