import { describe, expect, it } from "vitest";
import type { WorkPerson } from "@/lib/workTypes";
import {
  commentPreview,
  encodeMentions,
  extractMentionedIds,
  filterMentionPeople,
  insertMention,
  mentionPlainText,
  mentionQueryAt,
  parseMentionSegments,
} from "./workMentions";

const simon: WorkPerson = { id: "simon", name: "Simon Andersson", initials: "SA" };
const anna: WorkPerson = { id: "anna", name: "Anna", initials: "AN" };

describe("mentionQueryAt", () => {
  it("opens after a fresh @", () => {
    expect(mentionQueryAt("Hello @", 7)).toEqual({ start: 6, query: "" });
    expect(mentionQueryAt("Hello @si", 9)).toEqual({ start: 6, query: "si" });
  });

  it("ignores email-style at-signs and completed mentions", () => {
    expect(mentionQueryAt("a@b.com", 3)).toBeNull();
    expect(mentionQueryAt("Hi @[Anna](anna) more", 16)).toBeNull();
    expect(
      mentionQueryAt("@Niklas Eriksson Kan du", 23, [
        { id: "n", name: "Niklas Eriksson", initials: "NE" },
      ])
    ).toBeNull();
  });
});

describe("filterMentionPeople", () => {
  it("filters by name or initials", () => {
    expect(filterMentionPeople([simon, anna], "an").map((p) => p.id)).toEqual([
      "simon",
      "anna",
    ]);
    expect(filterMentionPeople([simon, anna], "sa").map((p) => p.id)).toEqual([
      "simon",
    ]);
  });
});

describe("insertMention and extract", () => {
  it("inserts a readable mention and encodes it for storage", () => {
    const next = insertMention("Hi @si", 3, 6, simon);
    expect(next.text).toBe("Hi @Simon Andersson ");
    const encoded = encodeMentions(next.text, [simon, anna]);
    expect(encoded).toBe("Hi @[Simon Andersson](simon) ");
    expect(extractMentionedIds(encoded)).toEqual(["simon"]);
    expect(mentionPlainText(encoded)).toBe("Hi @Simon Andersson ");
  });
});

describe("parseMentionSegments", () => {
  it("splits text and mentions", () => {
    expect(
      parseMentionSegments("See @[Anna](anna) and @[Simon Andersson](simon).")
    ).toEqual([
      { type: "text", value: "See " },
      { type: "mention", value: "Anna", id: "anna" },
      { type: "text", value: " and " },
      { type: "mention", value: "Simon Andersson", id: "simon" },
      { type: "text", value: "." },
    ]);
  });
});

describe("commentPreview", () => {
  it("collapses whitespace and truncates", () => {
    expect(commentPreview("Hi   @[Anna](anna)")).toBe("Hi @Anna");
    expect(commentPreview("x".repeat(200)).endsWith("…")).toBe(true);
  });
});
