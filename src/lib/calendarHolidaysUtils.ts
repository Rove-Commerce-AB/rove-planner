export type CalendarHoliday = {
  id: string;
  calendar_id: string;
  holiday_date: string;
  name: string;
};

export function hasHolidayInRange(
  holidays: CalendarHoliday[],
  dateFrom: string,
  dateTo: string
): boolean {
  return holidays.some(
    (h) => h.holiday_date >= dateFrom && h.holiday_date <= dateTo
  );
}

export function countHolidaysInRange(
  holidays: CalendarHoliday[],
  dateFrom: string,
  dateTo: string
): number {
  return holidays.filter(
    (h) => h.holiday_date >= dateFrom && h.holiday_date <= dateTo
  ).length;
}

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function countWeekdayHolidaysInRange(
  holidays: CalendarHoliday[],
  dateFrom: string,
  dateTo: string
): number {
  return holidays.filter((h) => {
    if (h.holiday_date < dateFrom || h.holiday_date > dateTo) return false;
    const day = getDayOfWeek(h.holiday_date);
    return day >= 1 && day <= 5;
  }).length;
}
