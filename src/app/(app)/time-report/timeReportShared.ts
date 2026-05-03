export const TIME_REPORT_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** `Date#getDay()` 0=Sun … 6=Sat — for narrow month grid column headers. */
export const TIME_REPORT_MONTH_GRID_DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/** localStorage key for persisting month vs week view on the time report page. */
export const TIME_REPORT_VIEW_MODE_STORAGE_KEY = "roveplanner.time-report.view-mode";

export const TIME_REPORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
