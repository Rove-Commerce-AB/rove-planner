import { describe, expect, it } from "vitest";
import {
  allocationIdentityKey,
  encodeBillingItemKey,
  parseBillingItemKey,
  resolveAllocationIdentity,
} from "./billingItem";

describe("billingItem", () => {
  it("round-trips role, customer rate, and project rate keys", () => {
    const roleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const rateId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(parseBillingItemKey(roleId)).toEqual({ kind: "role", roleId });
    expect(
      parseBillingItemKey(encodeBillingItemKey({ kind: "customer_rate", id: rateId }))
    ).toEqual({ kind: "customer_rate", id: rateId });
    expect(
      parseBillingItemKey(encodeBillingItemKey({ kind: "project_rate", id: rateId }))
    ).toEqual({ kind: "project_rate", id: rateId });
  });

  it("uses rate row ids for allocation identity when present", () => {
    expect(
      allocationIdentityKey({
        role_id: null,
        customer_rate_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        project_rate_id: null,
      })
    ).toBe("cr:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("parses a billing key on create into FK columns", () => {
    expect(
      resolveAllocationIdentity({
        role_id: "pr:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      })
    ).toEqual({
      role_id: null,
      customer_rate_id: null,
      project_rate_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
  });
});
