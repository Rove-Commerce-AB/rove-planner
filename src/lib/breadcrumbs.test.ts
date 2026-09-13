import { describe, expect, it } from "vitest";
import { breadcrumbsForPathname } from "./breadcrumbs";

describe("breadcrumbsForPathname", () => {
  it("uses Rove Work as the current page on the selector", () => {
    expect(breadcrumbsForPathname("/work")).toEqual([
      { label: "Rove Apps", href: "/" },
      { label: "Rove Work" },
    ]);
  });

  it("uses the customer as the current page on the customer landing", () => {
    expect(
      breadcrumbsForPathname("/work/cust-1", {
        workCustomerName: "Acme",
      })
    ).toEqual([
      { label: "Rove Apps", href: "/" },
      { label: "Rove Work", href: "/work" },
      { label: "Acme" },
    ]);
  });

  it("adds customer and board on a board path", () => {
    expect(
      breadcrumbsForPathname("/work/cust-1/board-1", {
        workCustomerName: "Acme",
        workBoardTitle: "Website",
      })
    ).toEqual([
      { label: "Rove Apps", href: "/" },
      { label: "Rove Work", href: "/work" },
      { label: "Acme", href: "/work/cust-1" },
      { label: "Website" },
    ]);
  });

  it("adds the issue key when an issue is open", () => {
    expect(
      breadcrumbsForPathname("/work/cust-1/board-1/issue-1", {
        workCustomerName: "Acme",
        workBoardTitle: "Website",
        workIssueKey: "RT-12",
      })
    ).toEqual([
      { label: "Rove Apps", href: "/" },
      { label: "Rove Work", href: "/work" },
      { label: "Acme", href: "/work/cust-1" },
      { label: "Website", href: "/work/cust-1/board-1" },
      { label: "RT-12" },
    ]);
  });
});
