import "server-only";

import { unstable_cache } from "next/cache";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getWorkingDaysByMonthInWeek, isoWeeksInYear } from "./dateUtils";
import { getAllocationsForWeeks } from "./allocationsQueries";
import { fetchCalendarHolidaysByCalendarIds } from "./calendarHolidaysQueries";
import { fetchCustomerRatesByCustomerIds } from "./customerRatesQueries";

import type {
  RevenueForecastByCustomer,
  RevenueForecastMonth,
} from "./revenueForecastTypes";

export type {
  RevenueForecastByCustomer,
  RevenueForecastMonth,
} from "./revenueForecastTypes";

const REVENUE_FORECAST_CACHE_REVALIDATE = 120;

function getWeeksInRange(
  yearFrom: number,
  weekFrom: number,
  yearTo: number,
  weekTo: number
): { year: number; week: number }[] {
  const weeks: { year: number; week: number }[] = [];
  let y = yearFrom;
  let w = weekFrom;
  while (y < yearTo || (y === yearTo && w <= weekTo)) {
    weeks.push({ year: y, week: w });
    const maxW = isoWeeksInYear(y);
    if (w < maxW) {
      w++;
    } else {
      y++;
      w = 1;
    }
  }
  return weeks;
}

/**
 * Planned revenue per month based on allocations.
 * Hours are distributed across months by working days (weekdays) in each week;
 * weekends and calendar holidays (per consultant) are excluded.
 */
export async function getRevenueForecast(
  yearFrom: number,
  weekFrom: number,
  yearTo: number,
  weekTo: number
): Promise<RevenueForecastMonth[]> {
  return unstable_cache(
    async () => {
      const weeks = getWeeksInRange(yearFrom, weekFrom, yearTo, weekTo);
      const allocations = await getAllocationsForWeeks(weeks);
      if (allocations.length === 0) {
        return [];
      }

      const consultantIds = [
        ...new Set(
          allocations
            .map((a) => a.consultant_id)
            .filter((id): id is string => id != null)
        ),
      ];
      const projectIds = [...new Set(allocations.map((a) => a.project_id))];

      const [consultantsRes, projectsRes] = await Promise.all([
        consultantIds.length
          ? cloudSqlPool.query<{
              id: string;
              calendar_id: string;
              role_id: string;
            }>(
              `SELECT id, calendar_id, role_id FROM consultants WHERE id = ANY($1::uuid[])`,
              [consultantIds]
            )
          : Promise.resolve({ rows: [] as never[] }),
        projectIds.length
          ? cloudSqlPool.query<{
              id: string;
              customer_id: string;
              type: string;
            }>(
              `SELECT id, customer_id, type FROM projects WHERE id = ANY($1::uuid[])`,
              [projectIds]
            )
          : Promise.resolve({ rows: [] as never[] }),
      ]);

      const consultants = new Map(
        consultantsRes.rows.map((c) => [
          c.id,
          { calendar_id: c.calendar_id, role_id: c.role_id },
        ])
      );
      const projects = new Map(
        projectsRes.rows.map((p) => [
          p.id,
          {
            customer_id: p.customer_id ?? "",
            type: p.type ?? "customer",
          },
        ])
      );

      const customerIds = [
        ...new Set(
          projectsRes.rows.map((p) => p.customer_id).filter(Boolean) as string[]
        ),
      ];
      const customersRes =
        customerIds.length > 0
          ? await cloudSqlPool.query<{ id: string; name: string }>(
              `SELECT id, name FROM customers WHERE id = ANY($1::uuid[])`,
              [customerIds]
            )
          : { rows: [] as { id: string; name: string }[] };
      const customerNames = new Map(
        customersRes.rows.map((c) => [c.id, c.name ?? c.id])
      );
      const allRates = await fetchCustomerRatesByCustomerIds(customerIds);
      const ratesByCustomer = new Map<
        string,
        { role_id: string; rate_per_hour: number; currency: string }[]
      >();
      for (const cid of customerIds) {
        ratesByCustomer.set(
          cid,
          allRates
            .filter((r) => r.customer_id === cid)
            .map((r) => ({
              role_id: r.role_id,
              rate_per_hour: r.rate_per_hour,
              currency: r.currency ?? "SEK",
            }))
        );
      }

      const calendarIds = [
        ...new Set(
          consultantsRes.rows.map((c) => c.calendar_id).filter(Boolean)
        ),
      ] as string[];
      const holidaysByCalendarRaw =
        await fetchCalendarHolidaysByCalendarIds(calendarIds);
      const holidaysByCalendar = new Map<string, Set<string>>();
      for (const calId of calendarIds) {
        const holidays = holidaysByCalendarRaw.get(calId) ?? [];
        holidaysByCalendar.set(
          calId,
          new Set(holidays.map((h) => h.holiday_date))
        );
      }

      const revenueByMonth = new Map<
        string,
        { revenue: number; currency: string; byCustomer: Map<string, number> }
      >();

      for (const a of allocations) {
        if (!a.consultant_id) continue;
        const consultant = consultants.get(a.consultant_id);
        const project = projects.get(a.project_id);
        if (!consultant || !project) continue;
        if (project.type !== "customer") continue;

        const customerId = project.customer_id;
        const roleId = a.role_id ?? consultant.role_id;
        if (!roleId) continue;

        const rates = ratesByCustomer.get(customerId) ?? [];
        const rateRow = rates.find((r) => r.role_id === roleId);
        if (!rateRow) continue;

        const holidaySet =
          holidaysByCalendar.get(consultant.calendar_id) ?? new Set<string>();
        const workingDaysByMonth = getWorkingDaysByMonthInWeek(
          a.year,
          a.week,
          holidaySet
        );
        const totalWorkingDays = workingDaysByMonth.reduce(
          (sum, x) => sum + x.workingDays,
          0
        );
        if (totalWorkingDays === 0) continue;

        const rate = rateRow.rate_per_hour;
        const currency = rateRow.currency;

        for (const { year, month, workingDays } of workingDaysByMonth) {
          const key = `${year}-${String(month).padStart(2, "0")}`;
          const hoursInMonth = (a.hours * workingDays) / totalWorkingDays;
          const revenue = hoursInMonth * rate;
          let existing = revenueByMonth.get(key);
          if (!existing) {
            existing = { revenue: 0, currency, byCustomer: new Map() };
            revenueByMonth.set(key, existing);
          }
          existing.revenue += revenue;
          const custRev = existing.byCustomer.get(customerId) ?? 0;
          existing.byCustomer.set(customerId, custRev + revenue);
        }
      }

      return Array.from(revenueByMonth.entries())
        .map(([key, { revenue, currency, byCustomer }]) => {
          const [y, m] = key.split("-").map(Number);
          const byCustomerList: RevenueForecastByCustomer[] = Array.from(
            byCustomer.entries()
          )
            .map(([customerId, rev]) => ({
              customerId,
              customerName: customerNames.get(customerId) ?? customerId,
              revenue: rev,
            }))
            .sort((a, b) => a.customerName.localeCompare(b.customerName));
          return {
            year: y,
            month: m,
            revenue,
            currency,
            byCustomer: byCustomerList,
          };
        })
        .sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month
        );
    },
    [
      "revenue-forecast",
      String(yearFrom),
      String(weekFrom),
      String(yearTo),
      String(weekTo),
    ],
    { revalidate: REVENUE_FORECAST_CACHE_REVALIDATE, tags: ["revenue-forecast"] }
  )();
}
