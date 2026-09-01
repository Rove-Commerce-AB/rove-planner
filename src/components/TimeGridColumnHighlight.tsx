"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";

type TimeGridColumnHighlightContextValue = {
  highlightedColumnIndex: number | null;
  setHighlightedColumnIndex: (index: number | null) => void;
};

const TimeGridColumnHighlightContext =
  createContext<TimeGridColumnHighlightContextValue | null>(null);

export function TimeGridColumnHighlightProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [highlightedColumnIndex, setHighlightedColumnIndex] = useState<
    number | null
  >(null);

  const value = useMemo(
    () => ({
      highlightedColumnIndex,
      setHighlightedColumnIndex,
    }),
    [highlightedColumnIndex]
  );

  return (
    <TimeGridColumnHighlightContext.Provider value={value}>
      {children}
    </TimeGridColumnHighlightContext.Provider>
  );
}

export function useTimeGridColumnHighlight(): TimeGridColumnHighlightContextValue {
  const ctx = useContext(TimeGridColumnHighlightContext);
  if (!ctx) {
    return {
      highlightedColumnIndex: null,
      setHighlightedColumnIndex: () => {},
    };
  }
  return ctx;
}

/** Attach to body cells under week/day columns; highlights the matching header cell (sticky thead). */
export function timeGridColumnCellInteractionProps(
  columnIndex: number,
  setHighlightedColumnIndex: (index: number | null) => void
): Pick<
  HTMLAttributes<HTMLTableCellElement>,
  "onMouseEnter" | "onMouseLeave" | "onFocusCapture" | "onBlurCapture"
> {
  return {
    onMouseEnter: () => setHighlightedColumnIndex(columnIndex),
    onMouseLeave: () => setHighlightedColumnIndex(null),
    onFocusCapture: () => setHighlightedColumnIndex(columnIndex),
    onBlurCapture: (e: FocusEvent<HTMLTableCellElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      setHighlightedColumnIndex(null);
    },
  };
}

/** Full-row hover/focus highlight for time-report (and similar) grids. */
export function useTimeGridRowHighlight(): {
  rowHoverHandlers: (
    rowKey: string
  ) => Pick<
    HTMLAttributes<HTMLTableRowElement>,
    "onMouseEnter" | "onMouseLeave" | "onFocusCapture" | "onBlurCapture"
  >;
  rowHoverClass: (rowKey: string) => string;
} {
  const [hoverRowKey, setHoverRowKey] = useState<string | null>(null);

  return {
    rowHoverHandlers: (rowKey: string) => ({
      onMouseEnter: () => setHoverRowKey(rowKey),
      onMouseLeave: () => setHoverRowKey(null),
      onFocusCapture: () => setHoverRowKey(rowKey),
      onBlurCapture: (e: FocusEvent<HTMLTableRowElement>) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        setHoverRowKey(null);
      },
    }),
    rowHoverClass: (rowKey: string) =>
      hoverRowKey === rowKey ? "time-grid-row-hover" : "",
  };
}
