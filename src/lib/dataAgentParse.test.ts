import { describe, expect, it } from "vitest";
import { parseDataAgentStream, parseStreamEvents } from "./dataAgentParse";

describe("parseStreamEvents", () => {
  it("parses a JSON array", () => {
    expect(parseStreamEvents('[{"a":1},{"b":2}]')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("parses a single JSON object", () => {
    expect(parseStreamEvents('{"a":1}')).toEqual([{ a: 1 }]);
  });

  it("parses NDJSON", () => {
    expect(parseStreamEvents('{"a":1}\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe("parseDataAgentStream", () => {
  it("joins the last text parts and maps a table from schema + rows", () => {
    const body = [
      JSON.stringify({
        systemMessage: { text: { parts: ["Looking up allocations…"] } },
      }),
      JSON.stringify({
        systemMessage: {
          data: {
            result: {
              schema: { fields: [{ name: "customer" }, { name: "hours" }] },
              data: [
                { customer: "Lexit", hours: 40 },
                { customer: "Acme", hours: 12 },
              ],
            },
          },
        },
      }),
      JSON.stringify({
        systemMessage: {
          text: { parts: ["Lexit has 40 hours.", "Acme has 12."] },
        },
      }),
    ].join("\n");

    expect(parseDataAgentStream(body)).toEqual({
      text: "Lexit has 40 hours.\nAcme has 12.",
      table: {
        headers: ["customer", "hours"],
        rows: [
          ["Lexit", 40],
          ["Acme", 12],
        ],
      },
    });
  });

  it("maps protobuf Struct rows onto schema field order", () => {
    const body = JSON.stringify({
      systemMessage: {
        text: { parts: ["Done"] },
        data: {
          result: {
            schema: { fields: [{ name: "name" }, { name: "total" }] },
            data: [
              {
                fields: {
                  name: { stringValue: "Lexit" },
                  total: { numberValue: 8 },
                },
              },
            ],
          },
        },
      },
    });

    expect(parseDataAgentStream(body)).toEqual({
      text: "Done",
      table: {
        headers: ["name", "total"],
        rows: [["Lexit", 8]],
      },
    });
  });

  it("ignores intermediate errors when a final answer exists", () => {
    const body = [
      JSON.stringify({
        systemMessage: { error: { text: "retrying query" } },
      }),
      JSON.stringify({
        systemMessage: { text: { parts: ["All good"] } },
      }),
    ].join("\n");

    expect(parseDataAgentStream(body)).toEqual({
      text: "All good",
      table: null,
    });
  });

  it("throws the last error when there is no answer", () => {
    const body = JSON.stringify({
      systemMessage: { error: { text: "Permission denied" } },
    });
    expect(() => parseDataAgentStream(body)).toThrow("Permission denied");
  });

  it("throws when the stream is empty of answers", () => {
    expect(() => parseDataAgentStream("{}")).toThrow(
      "The data agent did not return an answer"
    );
  });
});
