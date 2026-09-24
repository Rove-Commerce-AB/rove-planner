import { describe, expect, it } from "vitest";
import { scrollAxisFromPointer } from "./workDragAutoScroll";

function mockScrollEl(partial: {
  top: number;
  left: number;
  width: number;
  height: number;
  scrollHeight?: number;
  scrollWidth?: number;
  clientHeight?: number;
  clientWidth?: number;
}) {
  const el = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: partial.scrollHeight ?? 1000,
    scrollWidth: partial.scrollWidth ?? 1000,
    clientHeight: partial.clientHeight ?? partial.height,
    clientWidth: partial.clientWidth ?? partial.width,
    getBoundingClientRect: () => ({
      top: partial.top,
      left: partial.left,
      bottom: partial.top + partial.height,
      right: partial.left + partial.width,
      width: partial.width,
      height: partial.height,
      x: partial.left,
      y: partial.top,
      toJSON: () => ({}),
    }),
  };
  return el as unknown as HTMLElement;
}

describe("scrollAxisFromPointer", () => {
  it("scrolls up near the top edge", () => {
    const el = mockScrollEl({ top: 100, left: 0, width: 200, height: 400 });
    scrollAxisFromPointer(el, 100, 110, "y", 56, 20);
    expect(el.scrollTop).toBeLessThan(0);
  });

  it("scrolls down near the bottom edge", () => {
    const el = mockScrollEl({ top: 100, left: 0, width: 200, height: 400 });
    scrollAxisFromPointer(el, 100, 480, "y", 56, 20);
    expect(el.scrollTop).toBeGreaterThan(0);
  });

  it("does not scroll when centered", () => {
    const el = mockScrollEl({ top: 100, left: 0, width: 200, height: 400 });
    scrollAxisFromPointer(el, 100, 300, "y", 56, 20);
    expect(el.scrollTop).toBe(0);
  });

  it("scrolls horizontally near the right edge", () => {
    const el = mockScrollEl({ top: 0, left: 0, width: 400, height: 200 });
    scrollAxisFromPointer(el, 380, 100, "x", 56, 20);
    expect(el.scrollLeft).toBeGreaterThan(0);
  });

  it("skips when content does not overflow", () => {
    const el = mockScrollEl({
      top: 0,
      left: 0,
      width: 400,
      height: 400,
      scrollHeight: 400,
      clientHeight: 400,
    });
    scrollAxisFromPointer(el, 100, 10, "y", 56, 20);
    expect(el.scrollTop).toBe(0);
  });
});
