"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PageLoading } from "@/components/ui/PageLoading";

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
  const hasObservedRef = useRef(false);
  const lastRequestedParamsRef = useRef<{
    year: number;
    from: number;
    to: number;
  } | null>(null);

  const [ready, setReady] = useState(false);

  const applyWeeks = useCallback(
    (visibleWeeks: number, onNoChange?: () => void) => {
      const clamped = Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, visibleWeeks));
      const currentSpan =
        weekFrom <= weekTo
          ? weekTo - weekFrom + 1
          : 52 - weekFrom + 1 + weekTo;
      if (clamped === currentSpan) {
        onNoChange?.();
        return;
      }

      const newFrom = weekFrom;
      const newTo =
        weekFrom + clamped - 1 <= 52
          ? weekFrom + clamped - 1
          : weekFrom + clamped - 1 - 52;

      lastRequestedParamsRef.current = { year, from: newFrom, to: newTo };
      router.replace(`/allocation?year=${year}&from=${newFrom}&to=${newTo}`);
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
      timeoutId = setTimeout(() => {
        if (!hasObservedRef.current) {
          hasObservedRef.current = true;
          applyWeeks(visibleWeeks, () => setReady(true));
        } else {
          applyWeeks(visibleWeeks);
        }
      }, DEBOUNCE_MS);
    };

    const ro = new ResizeObserver(updateWeeks);
    ro.observe(el);

    return () => {
      ro.disconnect();
      clearTimeout(timeoutId);
    };
  }, [applyWeeks]);

  useEffect(() => {
    if (!ready && hasObservedRef.current && lastRequestedParamsRef.current) {
      const req = lastRequestedParamsRef.current;
      if (
        year === req.year &&
        weekFrom === req.from &&
        weekTo === req.to
      ) {
        setReady(true);
        lastRequestedParamsRef.current = null;
      }
    }
  }, [ready, year, weekFrom, weekTo]);

  return (
    <div ref={containerRef}>
      {ready ? children : <PageLoading />}
    </div>
  );
}
