import { describe, expect, it } from "vitest";
import {
  MAX_LITIUM_VERSION_ITEMS,
  parseLitiumVersionInput,
  parseLitiumVersionPayload,
  parseSubscriptionIdInput,
  requestHasLitiumVersionApiKey,
  secureStringEquals,
} from "./litiumVersion";

describe("parseSubscriptionIdInput", () => {
  it("returns null for empty values", () => {
    expect(parseSubscriptionIdInput(null)).toBeNull();
    expect(parseSubscriptionIdInput("  ")).toBeNull();
  });

  it("accepts a 6-character id", () => {
    expect(parseSubscriptionIdInput(" ab12CD ")).toBe("ab12CD");
  });

  it("rejects the wrong length", () => {
    expect(() => parseSubscriptionIdInput("abc")).toThrow(
      "Subscription ID must be exactly 6 characters"
    );
  });
});

describe("parseLitiumVersionInput", () => {
  it("returns null for empty values", () => {
    expect(parseLitiumVersionInput(null)).toBeNull();
    expect(parseLitiumVersionInput("  ")).toBeNull();
  });

  it("trims a version", () => {
    expect(parseLitiumVersionInput(" 8.21 ")).toBe("8.21");
  });

  it("rejects versions that are too long", () => {
    expect(() => parseLitiumVersionInput("x".repeat(201))).toThrow(
      "Litium version cannot be longer than 200 characters"
    );
  });
});

describe("parseLitiumVersionPayload", () => {
  it("parses an array and keeps the last duplicate", () => {
    const parsed = parseLitiumVersionPayload([
      { subscriptionId: "abc123", version: "8.1" },
      { subscriptionId: "ABC123", version: "8.2" },
      { subscriptionId: "def456", version: " 7.0 " },
    ]);
    expect(parsed).toEqual({
      ok: true,
      items: [
        { subscriptionId: "ABC123", version: "8.2" },
        { subscriptionId: "def456", version: "7.0" },
      ],
      invalid: [],
    });
  });

  it("accepts an items wrapper and reports invalid rows", () => {
    const parsed = parseLitiumVersionPayload({
      items: [
        { subscriptionId: "abc123", version: "8.1" },
        { subscriptionId: "nope", version: "8.1" },
      ],
    });
    expect(parsed).toEqual({
      ok: true,
      items: [{ subscriptionId: "abc123", version: "8.1" }],
      invalid: [
        { index: 1, error: "subscriptionId must be exactly 6 characters." },
      ],
    });
  });

  it("rejects a non-array body", () => {
    expect(parseLitiumVersionPayload({ subscriptionId: "abc123" })).toEqual({
      ok: false,
      error: "Body must be a JSON array of { subscriptionId, version }.",
    });
  });

  it("rejects an empty array", () => {
    expect(parseLitiumVersionPayload([])).toEqual({
      ok: false,
      error: "Body must include at least one item.",
    });
  });

  it("rejects an oversized payload", () => {
    const rows = Array.from({ length: MAX_LITIUM_VERSION_ITEMS + 1 }, (_, i) => ({
      subscriptionId: "abc123",
      version: String(i),
    }));
    expect(parseLitiumVersionPayload(rows).ok).toBe(false);
  });
});

describe("requestHasLitiumVersionApiKey", () => {
  it("accepts a bearer token or x-api-key", () => {
    const previous = process.env.LITIUM_VERSION_API_KEY;
    process.env.LITIUM_VERSION_API_KEY = "secret-key";
    try {
      const bearer = new Request("http://localhost/api/customers/litiumversion", {
        headers: { authorization: "Bearer secret-key" },
      });
      const header = new Request("http://localhost/api/customers/litiumversion", {
        headers: { "x-api-key": "secret-key" },
      });
      const wrong = new Request("http://localhost/api/customers/litiumversion", {
        headers: { authorization: "Bearer other" },
      });
      expect(requestHasLitiumVersionApiKey(bearer)).toBe(true);
      expect(requestHasLitiumVersionApiKey(header)).toBe(true);
      expect(requestHasLitiumVersionApiKey(wrong)).toBe(false);
    } finally {
      if (previous == null) delete process.env.LITIUM_VERSION_API_KEY;
      else process.env.LITIUM_VERSION_API_KEY = previous;
    }
  });
});

describe("secureStringEquals", () => {
  it("compares equal and unequal strings", () => {
    expect(secureStringEquals("abc", "abc")).toBe(true);
    expect(secureStringEquals("abc", "abd")).toBe(false);
    expect(secureStringEquals("abc", "ab")).toBe(false);
  });
});
