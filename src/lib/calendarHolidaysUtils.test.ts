import { describe, expect, it } from "vitest";
import type { CalendarHoliday } from "./calendarHolidaysUtils";
import {
  countHolidaysInRange,
  countWeekdayHolidaysInRange,
  hasHolidayInRange,
} from "./calendarHolidaysUtils";

const h = (
  id: string,
  calendarId: string,
  date: string,
  name: string
): CalendarHoliday => ({
  id,
  calendar_id: calendarId,
  holiday_date: date,
  name,
});

describe("hasHolidayInRange", () => {
  const holidays = [h("1", "cal", "2024-07-04", "Day")];

  it("returns true when a holiday falls inside [from, to]", () => {
    expect(hasHolidayInRange(holidays, "2024-07-01", "2024-07-31")).toBe(true);
  });

  it("returns false when no holiday in range", () => {
    expect(hasHolidayInRange(holidays, "2024-08-01", "2024-08-31")).toBe(
      false
    );
  });
});

describe("countHolidaysInRange", () => {
  it("counts inclusive string bounds", () => {
    const holidays = [
      h("1", "cal", "2024-01-02", "A"),
      h("2", "cal", "2024-01-03", "B"),
      h("3", "cal", "2024-01-10", "C"),
    ];
    expect(countHolidaysInRange(holidays, "2024-01-01", "2024-01-05")).toBe(2);
  });
});

describe("countWeekdayHolidaysInRange", () => {
  it("excludes Saturday and Sunday holidays", () => {
    const holidays = [
      h("1", "cal", "2024-03-09", "Sat"), // Saturday
      h("2", "cal", "2024-03-11", "Mon"),
    ];
    expect(
      countWeekdayHolidaysInRange(holidays, "2024-03-01", "2024-03-31")
    ).toBe(1);
  });
});
