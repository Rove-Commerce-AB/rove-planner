"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const LEFT_COL_WIDTH = 300;
const MIN_WEEK_WIDTH = 28;
const EXTRA_PADDING = 56;
const MIN_WEEKS = 8;
const MAX_WEEKS = 52;
const DEBOUNCE_MS = 100;

type Props = {
  year: number;
  weekFrom: number;
  weekTo: number;
  children: React.ReactNode;
};

export function AllocationViewportAdapter({
  year,
  weekFrom,
  weekTo,
  children,
}: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const applyWeeks = useCallback(
    (visibleWeeks: number) => {
      const clamped = Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, visibleWeeks));
      const currentSpan = weekTo - weekFrom + 1;
      if (clamped === currentSpan) return;

      const newTo = Math.min(52, weekFrom + clamped - 1);
      const newFrom = Math.max(1, newTo - clamped + 1);
      const actualTo = Math.min(52, newFrom + clamped - 1);

      router.replace(`/allocation?year=${year}&from=${newFrom}&to=${actualTo}`);
    },
    [year, weekFrom, weekTo, router]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const updateWeeks = () => {
      const w = el.clientWidth;
      if (w < 100) return;
      const available = w - LEFT_COL_WIDTH - EXTRA_PADDING;
      const visibleWeeks = Math.floor(available / MIN_WEEK_WIDTH);
      if (visibleWeeks < MIN_WEEKS) return;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => applyWeeks(visibleWeeks), DEBOUNCE_MS);
    };

    const ro = new ResizeObserver(updateWeeks);
    ro.observe(el);
    updateWeeks();

    return () => {
      ro.disconnect();
      clearTimeout(timeoutId);
    };
  }, [applyWeeks]);

  return <div ref={containerRef}>{children}</div>;
}
