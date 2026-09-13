import { describe, expect, it } from "vitest";
import {
  canSeeWorkBoard,
  canSeeWorkCustomer,
  filterVisibleWorkBoards,
} from "./workAccess";

const admin = { id: "admin-1", role: "admin" as const };
const member = { id: "member-1", role: "member" as const };
const customer = { id: "cust-user-1", role: "customer" as const };

describe("canSeeWorkCustomer", () => {
  it("lets admin see any customer", () => {
    expect(canSeeWorkCustomer(admin, [], "c1")).toBe(true);
  });

  it("lets members and customer users see only assigned customers", () => {
    expect(canSeeWorkCustomer(member, ["c1"], "c1")).toBe(true);
    expect(canSeeWorkCustomer(member, ["c1"], "c2")).toBe(false);
    expect(canSeeWorkCustomer(customer, ["c3"], "c3")).toBe(true);
    expect(canSeeWorkCustomer(customer, ["c3"], "c1")).toBe(false);
  });
});

describe("canSeeWorkBoard", () => {
  it("lets admin see any board", () => {
    const board = { customerIsInternal: false, memberAppUserIds: [] };
    expect(canSeeWorkBoard(admin, board)).toBe(true);
  });

  it("lets only members see a board", () => {
    const board = {
      customerIsInternal: false,
      memberAppUserIds: ["member-1"],
    };
    expect(canSeeWorkBoard(member, board)).toBe(true);
    expect(canSeeWorkBoard(customer, board)).toBe(false);
    expect(canSeeWorkBoard({ id: "other", role: "member" }, board)).toBe(
      false
    );
  });
});

describe("filterVisibleWorkBoards", () => {
  it("keeps boards the actor belongs to", () => {
    const boards = [
      { id: "a", customerIsInternal: false, memberAppUserIds: ["member-1"] },
      { id: "b", customerIsInternal: true, memberAppUserIds: ["member-1"] },
      { id: "c", customerIsInternal: false, memberAppUserIds: ["other"] },
    ];
    expect(filterVisibleWorkBoards(member, boards).map((b) => b.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
