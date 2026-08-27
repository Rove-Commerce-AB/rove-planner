import { describe, expect, it } from "vitest";
import {
  buildChatMessages,
  parseDataAgentStream,
  parseStreamEvents,
} from "./dataAgentParse";

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

describe("buildChatMessages", () => {
  it("appends the new question after prior user and agent turns", () => {
    expect(
      buildChatMessages("vilka kunder är han allokerad på?", [
        { role: "user", text: "hur mycket är Simon allokerad i december?" },
        { role: "agent", text: "Simon är allokerad totalt 34 timmar." },
      ])
    ).toEqual([
      {
        userMessage: {
          text: "hur mycket är Simon allokerad i december?",
        },
      },
      {
        systemMessage: {
          text: { parts: ["Simon är allokerad totalt 34 timmar."] },
        },
      },
      { userMessage: { text: "vilka kunder är han allokerad på?" } },
    ]);
  });

  it("keeps only the last 10 history turns", () => {
    const history = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "agent") as "user" | "agent",
      text: `turn ${i}`,
    }));
    const messages = buildChatMessages("now", history);
    expect(messages).toHaveLength(11);
    expect(messages[0]).toEqual({ userMessage: { text: "turn 2" } });
    expect(messages[messages.length - 1]).toEqual({
      userMessage: { text: "now" },
    });
  });
});
