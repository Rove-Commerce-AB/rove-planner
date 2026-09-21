export const DRAG_AUTO_SCROLL_EDGE_PX = 56;
export const DRAG_AUTO_SCROLL_MAX_PX = 22;

export type RectLike = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

function containsPoint(
  rect: RectLike,
  clientX: number,
  clientY: number
): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function intensityTowardEdge(distanceIntoEdge: number, edgePx: number): number {
  return Math.min(1, Math.max(0, distanceIntoEdge / edgePx));
}

/**
 * Scroll delta for a nested overflow column during HTML5 drag.
 * Native auto-scroll often fails here: dragover preventDefault disables it,
 * and the column title sits outside the scroll container (so dragging "to the
 * top" never reaches the scroll edge).
 */
export function dragAutoScrollDelta(
  pointer: { clientX: number; clientY: number },
  scrollRect: RectLike,
  options?: {
    outerRect?: RectLike;
    edgePx?: number;
    maxPx?: number;
  }
): number {
  const edgePx = options?.edgePx ?? DRAG_AUTO_SCROLL_EDGE_PX;
  const maxPx = options?.maxPx ?? DRAG_AUTO_SCROLL_MAX_PX;
  const outer = options?.outerRect ?? scrollRect;
  if (!containsPoint(outer, pointer.clientX, pointer.clientY)) return 0;

  if (pointer.clientY < scrollRect.top) {
    const overflow = scrollRect.top - pointer.clientY;
    const t = Math.min(1, 0.5 + intensityTowardEdge(overflow, edgePx));
    return -Math.max(1, Math.round(t * maxPx));
  }
  if (pointer.clientY > scrollRect.bottom) {
    const overflow = pointer.clientY - scrollRect.bottom;
    const t = Math.min(1, 0.5 + intensityTowardEdge(overflow, edgePx));
    return Math.max(1, Math.round(t * maxPx));
  }

  const topDist = pointer.clientY - scrollRect.top;
  if (topDist < edgePx) {
    const t = intensityTowardEdge(edgePx - topDist, edgePx);
    return -Math.max(1, Math.round(t * maxPx));
  }
  const bottomDist = scrollRect.bottom - pointer.clientY;
  if (bottomDist < edgePx) {
    const t = intensityTowardEdge(edgePx - bottomDist, edgePx);
    return Math.max(1, Math.round(t * maxPx));
  }
  return 0;
}

export function applyDragAutoScroll(
  container: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  },
  delta: number
): number {
  if (delta === 0) return 0;
  const max = Math.max(0, container.scrollHeight - container.clientHeight);
  const next = Math.min(max, Math.max(0, container.scrollTop + delta));
  const applied = next - container.scrollTop;
  container.scrollTop = next;
  return applied;
}
