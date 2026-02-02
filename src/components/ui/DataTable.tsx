"use client";

import { EmptyState } from "./EmptyState";

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  align?: "left" | "right";
  /** Cell width as CSS value or Tailwind width class; optional */
  width?: string;
  render: (row: T) => React.ReactNode;
};

export type DataTableEmptyState = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Row click (navigates to detail). Prefer this or rowHref, not both. */
  onRowClick?: (row: T) => void;
  /** Row link href. Use this or onRowClick, not both. */
  rowHref?: (row: T) => string;
  emptyState?: DataTableEmptyState;
  loading?: boolean;
  density?: "compact" | "comfortable";
  stickyHeader?: boolean;
  /** Optional min width for horizontal scroll (e.g. "640px") */
  minWidth?: string;
};

const densityClasses = {
  compact: "px-3 py-2",
  comfortable: "px-4 py-3",
};

/**
 * DataTable: dumb table component. Receives prepared data only (no business logic).
 * DESIGN_SYSTEM + UI_PATTERNS: sticky header, subtle dividers, hover, focus-visible.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  rowHref,
  emptyState,
  loading = false,
  density = "compact",
  stickyHeader = true,
  minWidth = "640px",
}: DataTableProps<T>) {
  const cellPadding = densityClasses[density];

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-border bg-bg-muted/70 font-secondary text-xs font-medium uppercase tracking-wider text-text-primary opacity-80">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`${cellPadding} text-left`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={`${cellPadding} animate-pulse bg-bg-muted/50`}
                  >
                    <span className="invisible">—</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0 && emptyState) {
    return (
      <div className="p-6">
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
          actionLabel={emptyState.actionLabel}
          onAction={emptyState.onAction}
        />
      </div>
    );
  }

  const TableWrapper = stickyHeader ? "div" : "div";
  const theadSticky = stickyHeader ? "sticky top-0 z-10 bg-bg-muted/95 backdrop-px-1" : "";

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full table-fixed text-sm"
        style={{ minWidth }}
      >
        <colgroup>
          {columns.map((col) => (
            <col key={col.id} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        <thead className={theadSticky}>
          <tr className="border-b border-border bg-bg-muted/70 font-secondary text-xs font-medium uppercase tracking-wider text-text-primary opacity-80">
            {columns.map((col) => (
              <th
                key={col.id}
                className={`${cellPadding} ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            const href = rowHref?.(row);
            const isClickable = onRowClick != null || href != null;
            const content = (
              <>
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={`border-b border-border text-text-primary ${cellPadding} ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </>
            );
            if (href != null) {
              return (
                <tr
                  key={id}
                  className={`transition-colors ${isClickable ? "cursor-pointer hover:bg-bg-muted/50 focus-within:bg-bg-muted/50" : ""}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  <td colSpan={columns.length} className="p-0">
                    <a
                      href={href}
                      className="flex contents focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset"
                      tabIndex={0}
                    >
                      {content}
                    </a>
                  </td>
                </tr>
              );
            }
            return (
              <tr
                key={id}
                className={`transition-colors ${isClickable ? "cursor-pointer hover:bg-bg-muted/50 focus-within:bg-bg-muted/50" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {content}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
