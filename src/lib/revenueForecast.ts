import { unstable_cache } from "next/cache";
import { getWorkingDaysByMonthInWeek } from "./dateUtils";
import { getAllocationsForWeekRange } from "./allocations";
import { getCalendarHolidays } from "./calendarHolidays";
import { getCustomerRates } from "./customerRates";
import { supabase } from "./supabaseClient";

export type RevenueForecastMonth = {
  year: number;
  month: number;
  revenue: number;
  currency: string;
};

const REVENUE_FORECAST_CACHE_REVALIDATE = 120;

/**
 * Planerad intäkt per månad baserat på allokeringar.
 * Timmar fördelas mellan månader utifrån arbetsdagar (vardagar) i varje vecka;
 * helger och kalenderhelgdagar (per konsult) exkluderas.
 */
export async function getRevenueForecast(
  yearFrom: number,
  weekFrom: number,
  yearTo: number,
  weekTo: number
): Promise<RevenueForecastMonth[]> {
  return unstable_cache(
    async () => {
      let allocations: Awaited<ReturnType<typeof getAllocationsForWeekRange>>;
      if (yearFrom === yearTo) {
        allocations = await getAllocationsForWeekRange(yearFrom, weekFrom, weekTo);
      } else {
        const [first, second] = await Promise.all([
          getAllocationsForWeekRange(yearFrom, weekFrom, 52),
          getAllocationsForWeekRange(yearTo, 1, weekTo),
        ]);
        allocations = [...first, ...second];
      }
      if (allocations.length === 0) {
        return [];
      }

      const consultantIds = [...new Set(allocations.map((a) => a.consultant_id))];
  const projectIds = [...new Set(allocations.map((a) => a.project_id))];

  const [consultantsData, projectsData] = await Promise.all([
    supabase
      .from("consultants")
      .select("id,calendar_id,role_id")
      .in("id", consultantIds),
    supabase
      .from("projects")
      .select("id,customer_id,type")
      .in("id", projectIds),
  ]);

  if (consultantsData.error) throw consultantsData.error;
  if (projectsData.error) throw projectsData.error;

  const consultants = new Map(
    (consultantsData.data ?? []).map((c) => [
      c.id,
      { calendar_id: c.calendar_id, role_id: c.role_id },
    ])
  );
  const projects = new Map(
    (projectsData.data ?? []).map((p) => [
      p.id,
      {
        customer_id: p.customer_id ?? "",
        type: (p.type as string) ?? "customer",
      },
    ])
  );

  const customerIds = [
    ...new Set(
      (projectsData.data ?? [])
        .map((p) => p.customer_id)
        .filter(Boolean) as string[]
    ),
  ];
  const ratesByCustomer = new Map<string, { role_id: string; rate_per_hour: number; currency: string }[]>();
  await Promise.all(
    customerIds.map(async (cid) => {
      const rates = await getCustomerRates(cid);
      ratesByCustomer.set(
        cid,
        rates.map((r) => ({
          role_id: r.role_id,
          rate_per_hour: r.rate_per_hour,
          currency: r.currency ?? "SEK",
        }))
      );
    })
  );

  const calendarIds = [
    ...new Set(
      (consultantsData.data ?? []).map((c) => c.calendar_id).filter(Boolean)
    ),
  ] as string[];
  const holidaysByCalendar = new Map<string, Set<string>>();
  await Promise.all(
    calendarIds.map(async (calId) => {
      const holidays = await getCalendarHolidays(calId);
      holidaysByCalendar.set(
        calId,
        new Set(holidays.map((h) => h.holiday_date))
      );
    })
  );

  const revenueByMonth = new Map<string, { revenue: number; currency: string }>();

  for (const a of allocations) {
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

    const holidaySet = holidaysByCalendar.get(consultant.calendar_id) ?? new Set<string>();
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
    const existing = revenueByMonth.get(key);
    if (existing) {
      existing.revenue += revenue;
    } else {
      revenueByMonth.set(key, { revenue, currency });
    }
  }
  }

      return Array.from(revenueByMonth.entries())
        .map(([key, { revenue, currency }]) => {
          const [y, m] = key.split("-").map(Number);
          return { year: y, month: m, revenue, currency };
        })
        .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
    },
    ["revenue-forecast", String(yearFrom), String(weekFrom), String(yearTo), String(weekTo)],
    { revalidate: REVENUE_FORECAST_CACHE_REVALIDATE, tags: ["revenue-forecast"] }
  )();
}
