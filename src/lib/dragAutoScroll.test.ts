import { describe, expect, it } from "vitest";
import {
  DRAG_AUTO_SCROLL_EDGE_PX,
  applyDragAutoScroll,
  dragAutoScrollDelta,
} from "./dragAutoScroll";

const column = { top: 80, right: 300, bottom: 700, left: 40 };
const scroll = { top: 120, right: 300, bottom: 700, left: 40 };

describe("dragAutoScrollDelta", () => {
  it("scrolls up when the pointer is over the column header above the list", () => {
    expect(
      dragAutoScrollDelta(
        { clientX: 100, clientY: 100 },
        scroll,
        { outerRect: column }
      )
    ).toBeLessThan(0);
  });

  it("scrolls faster closer to the top edge of the list", () => {
    const nearTop = dragAutoScrollDelta(
      { clientX: 100, clientY: scroll.top + 4 },
      scroll,
      { outerRect: column }
    );
    const nearEdge = dragAutoScrollDelta(
      { clientX: 100, clientY: scroll.top + DRAG_AUTO_SCROLL_EDGE_PX - 4 },
      scroll,
      { outerRect: column }
    );
    expect(nearTop).toBeLessThan(nearEdge);
    expect(nearTop).toBeLessThan(0);
    expect(nearEdge).toBeLessThan(0);
  });

  it("does not scroll in the middle of the list", () => {
    expect(
      dragAutoScrollDelta(
        { clientX: 100, clientY: 400 },
        scroll,
        { outerRect: column }
      )
    ).toBe(0);
  });

  it("scrolls down near the bottom of the list", () => {
    expect(
      dragAutoScrollDelta(
        { clientX: 100, clientY: scroll.bottom - 8 },
        scroll,
        { outerRect: column }
      )
    ).toBeGreaterThan(0);
  });

  it("ignores the pointer when it is outside the column", () => {
    expect(
      dragAutoScrollDelta(
        { clientX: 10, clientY: 100 },
        scroll,
        { outerRect: column }
      )
    ).toBe(0);
  });
});

describe("applyDragAutoScroll", () => {
  it("clamps to the top of the list", () => {
    const container = { scrollTop: 10, scrollHeight: 800, clientHeight: 400 };
    expect(applyDragAutoScroll(container, -40)).toBe(-10);
    expect(container.scrollTop).toBe(0);
  });

  it("clamps to the bottom of the list", () => {
    const container = { scrollTop: 390, scrollHeight: 800, clientHeight: 400 };
    expect(applyDragAutoScroll(container, 40)).toBe(10);
    expect(container.scrollTop).toBe(400);
  });

  it("does nothing when the list is not overflowing", () => {
    const container = { scrollTop: 0, scrollHeight: 200, clientHeight: 400 };
    expect(applyDragAutoScroll(container, -20)).toBe(0);
    expect(container.scrollTop).toBe(0);
  });
});
