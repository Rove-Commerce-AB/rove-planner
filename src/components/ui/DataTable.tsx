"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "./EmptyState";

const tableBorder = "border-panel";

/** Compact density: tight rows and headers; header matches PanelSectionTitle on detail panels. */
const compact = {
  header:
    "px-3 py-2 text-[11px] font-medium text-text-primary opacity-65",
  cell: "px-3 py-1 text-sm text-text-primary",
  cellSecondary: "px-3 py-1 text-sm text-text-primary opacity-70",
  row: `border-b ${tableBorder}`,
  headerRow: `border-b ${tableBorder} bg-bg-muted/20`,
  emptyCell: "px-3 py-2 text-center text-sm text-text-primary opacity-60",
} as const;

/** Comfortable density: more vertical space; header matches PanelSectionTitle. */
const comfortable = {
  header:
    "px-3 py-2 text-[11px] font-medium text-text-primary opacity-65",
  cell: "px-3 py-2 text-sm text-text-primary",
  cellSecondary: "px-3 py-2 text-sm text-text-primary opacity-70",
  row: `border-b ${tableBorder}`,
  headerRow: `border-b ${tableBorder} bg-bg-muted/20`,
  emptyCell: "px-3 py-4 text-center text-sm text-text-primary opacity-60",
} as const;

export type Density = "compact" | "comfortable";

export type DataTableColumn<T> = {
  id: string;
  /** Header content (string or ReactNode for custom sort controls). */
  header: React.ReactNode;
  /** Left, right, or center. Default left for identity columns; use right for numeric/time/actions. */
  align?: "left" | "right" | "center";
  /** Cell renderer. Return ReactNode; use secondary style (opacity) for metadata. */
  cell: (row: T) => React.ReactNode;
  /** Optional width (e.g. "4rem" for actions column). */
  width?: string;
  /** If true, cell uses secondary (de-emphasized) styling. */
  secondary?: boolean;
};

export type EmptyStateConfig = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** If provided, row is a link (use with or without onRowClick). */
  rowHref?: (row: T) => string | undefined;
  /** If provided and rowHref not set, row is clickable. */
  onRowClick?: (row: T) => void;
  emptyState?: EmptyStateConfig;
  loading?: boolean;
  /** Default "compact". Use "comfortable" only for text-heavy views. */
  density?: Density;
  /** Default true when used inside a scrollable panel. */
  stickyHeader?: boolean;
  className?: string;
};

function SkeletonRow({ colCount, density }: { colCount: number; density: Density }) {
  const styles = density === "compact" ? compact : comfortable;
  return (
    <tr className={styles.row}>
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className={i === 0 ? styles.cell : styles.cellSecondary}>
          <span className="inline-block h-4 w-24 animate-pulse rounded bg-bg-muted" aria-hidden />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  rowHref,
  onRowClick,
  emptyState,
  loading = false,
  density = "compact",
  stickyHeader = true,
  className = "",
}: DataTableProps<T>) {
  const router = useRouter();
  const styles = density === "compact" ? compact : comfortable;
  const handleRowClick = onRowClick ?? (rowHref ? (row: T) => router.push(rowHref(row) ?? "#") : undefined);
  const isInteractive = Boolean(handleRowClick);

  if (!loading && rows.length === 0 && emptyState) {
    return (
      <EmptyState
        title={emptyState.title}
        description={emptyState.description}
        actionLabel={emptyState.actionLabel}
        onAction={emptyState.onAction}
      />
    );
  }

  const table = (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-[200px] text-sm ${className}`.trim()}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.id} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        <thead
          className={
            stickyHeader ? "sticky top-0 z-10 bg-bg-muted/20" : undefined
          }
        >
          <tr className={styles.headerRow}>
            {columns.map((col) => (
              <th
                key={col.id}
                className={`${styles.header} ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left"
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} colCount={columns.length} density={density} />
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                No data
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = getRowId(row);
              const content = (
                <>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={
                        col.secondary
                          ? styles.cellSecondary
                          : `${styles.cell} ${
                                col.align === "right"
                                  ? "text-right"
                                  : col.align === "center"
                                    ? "text-center"
                                    : "text-left"
                              }`
                      }
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </>
              );

              if (isInteractive && handleRowClick) {
                return (
                  <tr
                    key={id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(row);
                      }
                    }}
                    className={`${styles.row} cursor-pointer transition-colors hover:bg-bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset`}
                  >
                    {content}
                  </tr>
                );
              }

              return (
                <tr key={id} className={styles.row}>
                  {content}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return table;
}
