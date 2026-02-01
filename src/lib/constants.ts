/** Must match --color-customer-default in styles/tokens.css */
export const DEFAULT_CUSTOMER_COLOR = "#3b82f6";

/** Chart/mock colors – matches accent-1 through accent-4 in tokens */
export const MOCK_CHART_COLORS = ["#3b82f6", "#22c55e", "#a855f7", "#f97316"] as const;

/** Must match --color-text-muted in styles/tokens.css. Used when no project color. */
export const DEFAULT_PROJECT_COLOR = "#9ca3af";

/** Fallback when calendar hours are missing. Should match typical full-time (e.g. Swedish 40h). */
export const DEFAULT_HOURS_PER_WEEK = 40;
