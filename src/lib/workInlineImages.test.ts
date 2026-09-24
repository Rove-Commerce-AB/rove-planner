import { describe, expect, it } from "vitest";
import {
  joinWorkInlineImages,
  splitWorkInlineImages,
} from "./workInlineImages";

describe("workInlineImages", () => {
  it("splits and rejoins image markdown", () => {
    const raw =
      "Hello\n\n![image](/api/work/files/11111111-1111-1111-1111-111111111111)\n![shot](/api/work/files/22222222-2222-2222-2222-222222222222)";
    const split = splitWorkInlineImages(raw);
    expect(split.text).toBe("Hello");
    expect(split.fileIds).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ]);
    expect(joinWorkInlineImages(split.text, split.fileIds)).toBe(
      "Hello\n\n![image](/api/work/files/11111111-1111-1111-1111-111111111111)\n![image](/api/work/files/22222222-2222-2222-2222-222222222222)"
    );
  });

  it("handles image-only bodies", () => {
    const id = "33333333-3333-3333-3333-333333333333";
    const split = splitWorkInlineImages(`![image](/api/work/files/${id})`);
    expect(split.text).toBe("");
    expect(split.fileIds).toEqual([id]);
    expect(joinWorkInlineImages("", [id])).toBe(
      `![image](/api/work/files/${id})`
    );
  });
});
