import { describe, expect, it } from "vitest";
import {
  collectWorkIssueIdsFromLinkKeys,
  workIssueIdFromLinkKey,
  workIssueLinkKey,
} from "./workIssueTimeLink";

describe("workIssueTimeLink", () => {
  it("round-trips a work issue id", () => {
    const id = "2d1c0b9a-8f7e-4d3c-b2a1-0f9e8d7c6b5a";
    expect(workIssueLinkKey(id)).toBe(`work:${id}`);
    expect(workIssueIdFromLinkKey(`work:${id}`)).toBe(id);
  });

  it("ignores jira and empty keys", () => {
    expect(workIssueIdFromLinkKey("jira:ABC-1")).toBeNull();
    expect(workIssueIdFromLinkKey("")).toBeNull();
    expect(workIssueIdFromLinkKey(null)).toBeNull();
  });

  it("collects unique work ids from mixed keys", () => {
    const id = "2d1c0b9a-8f7e-4d3c-b2a1-0f9e8d7c6b5a";
    expect(
      collectWorkIssueIdsFromLinkKeys([
        `work:${id}`,
        "jira:ABC-1",
        `work:${id}`,
        "",
      ])
    ).toEqual([id]);
  });
});
