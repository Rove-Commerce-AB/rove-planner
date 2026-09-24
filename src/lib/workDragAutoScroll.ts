/** Edge auto-scroll while dragging Work board cards/columns. */

export type DragScrollAxis = "x" | "y";

export type DragScrollTarget = {
  el: HTMLElement;
  axis: DragScrollAxis;
};

const EDGE_PX = 56;
const MAX_SPEED_PX = 22;

/**
 * Scroll `el` on `axis` when the pointer is within EDGE_PX of that edge.
 * Speed ramps up the deeper into the zone the pointer is.
 */
export function scrollAxisFromPointer(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  axis: DragScrollAxis,
  edgePx = EDGE_PX,
  maxSpeed = MAX_SPEED_PX
): void {
  const rect = el.getBoundingClientRect();
  if (axis === "y") {
    if (el.scrollHeight <= el.clientHeight + 1) return;
    const topEdge = rect.top + edgePx;
    const bottomEdge = rect.bottom - edgePx;
    if (clientY < topEdge) {
      const t = Math.min(1, (topEdge - clientY) / edgePx);
      el.scrollTop -= maxSpeed * t;
    } else if (clientY > bottomEdge) {
      const t = Math.min(1, (clientY - bottomEdge) / edgePx);
      el.scrollTop += maxSpeed * t;
    }
    return;
  }

  if (el.scrollWidth <= el.clientWidth + 1) return;
  const leftEdge = rect.left + edgePx;
  const rightEdge = rect.right - edgePx;
  if (clientX < leftEdge) {
    const t = Math.min(1, (leftEdge - clientX) / edgePx);
    el.scrollLeft -= maxSpeed * t;
  } else if (clientX > rightEdge) {
    const t = Math.min(1, (clientX - rightEdge) / edgePx);
    el.scrollLeft += maxSpeed * t;
  }
}

export type DragAutoScrollController = {
  setPointer: (clientX: number, clientY: number) => void;
  setTargets: (targets: DragScrollTarget[]) => void;
  stop: () => void;
};

/** Runs a rAF loop so scrolling continues while the pointer stays in an edge zone. */
export function startDragAutoScroll(): DragAutoScrollController {
  let pointer = { x: 0, y: 0 };
  let targets: DragScrollTarget[] = [];
  let raf = 0;
  let running = true;

  function frame() {
    if (!running) return;
    for (const target of targets) {
      scrollAxisFromPointer(target.el, pointer.x, pointer.y, target.axis);
    }
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  return {
    setPointer(clientX, clientY) {
      pointer = { x: clientX, y: clientY };
    },
    setTargets(next) {
      targets = next;
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      targets = [];
    },
  };
}

export function issueScrollElFromPoint(
  clientX: number,
  clientY: number
): HTMLElement | null {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!(hit instanceof Element)) return null;
  const direct = hit.closest("[data-issue-scroll]");
  if (direct instanceof HTMLElement) return direct;
  const column = hit.closest("section");
  const nested = column?.querySelector("[data-issue-scroll]");
  return nested instanceof HTMLElement ? nested : null;
}
