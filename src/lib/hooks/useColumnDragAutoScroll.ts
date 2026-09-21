import { useCallback, useEffect, useRef } from "react";
import { applyDragAutoScroll, dragAutoScrollDelta } from "@/lib/dragAutoScroll";

type DragScrollState = {
  container: HTMLElement;
  column: HTMLElement;
  clientX: number;
  clientY: number;
};

export function useColumnDragAutoScroll(
  active: () => boolean,
  onScrolled: (column: HTMLElement, clientY: number) => void
) {
  const activeRef = useRef(active);
  const onScrolledRef = useRef(onScrolled);
  const pointerRef = useRef<DragScrollState | null>(null);
  const rafRef = useRef(0);
  const listeningRef = useRef(false);
  const startRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    activeRef.current = active;
    onScrolledRef.current = onScrolled;
  }, [active, onScrolled]);

  useEffect(() => {
    function onDragOver(event: DragEvent) {
      if (!activeRef.current()) {
        pointerRef.current = null;
        return;
      }
      const target = event.target;
      const column =
        target instanceof Element
          ? target.closest("section[data-board-column]")
          : null;
      if (!(column instanceof HTMLElement)) {
        pointerRef.current = null;
        return;
      }
      const container = column.querySelector("[data-column-scroll]");
      if (!(container instanceof HTMLElement)) return;
      pointerRef.current = {
        container,
        column,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }

    function tick() {
      rafRef.current = 0;
      if (!listeningRef.current) return;
      const state = pointerRef.current;
      if (state && activeRef.current()) {
        const delta = dragAutoScrollDelta(
          { clientX: state.clientX, clientY: state.clientY },
          state.container.getBoundingClientRect(),
          { outerRect: state.column.getBoundingClientRect() }
        );
        if (applyDragAutoScroll(state.container, delta) !== 0) {
          onScrolledRef.current(state.column, state.clientY);
        }
      }
      rafRef.current = window.requestAnimationFrame(tick);
    }

    function start() {
      if (listeningRef.current) return;
      listeningRef.current = true;
      document.addEventListener("dragover", onDragOver, true);
      rafRef.current = window.requestAnimationFrame(tick);
    }

    function stop() {
      listeningRef.current = false;
      pointerRef.current = null;
      document.removeEventListener("dragover", onDragOver, true);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    }

    startRef.current = start;
    stopRef.current = stop;
    return () => stop();
  }, []);

  const startDragAutoScroll = useCallback(() => {
    startRef.current();
  }, []);
  const stopDragAutoScroll = useCallback(() => {
    stopRef.current();
  }, []);

  return { startDragAutoScroll, stopDragAutoScroll };
}
