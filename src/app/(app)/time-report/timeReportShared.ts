export const TIME_REPORT_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** `Date#getDay()` 0=Sun … 6=Sat — for narrow month grid column headers. */
export const TIME_REPORT_MONTH_GRID_DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

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
