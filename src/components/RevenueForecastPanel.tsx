"use client";

import { useState, useMemo } from "react";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import type { RevenueForecastMonth } from "@/lib/revenueForecast";
import { getMonthLabel } from "@/lib/dateUtils";
import { Panel } from "@/components/ui";

type Props = {
  forecast: RevenueForecastMonth[];
  currentYear: number;
};

const panelHeaderBorder = "border-panel";

function formatRevenue(value: number, currency: string): string {
  return (
    new Intl.NumberFormat("sv-SE", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) +
    " " +
    currency
  );
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

type YearGroup = {
  year: number;
  months: RevenueForecastMonth[];
  totalRevenue: number;
  currency: string;
};

function groupForecastByYear(
  forecast: RevenueForecastMonth[]
): YearGroup[] {
  const byYear = new Map<
    number,
    { months: RevenueForecastMonth[]; totalRevenue: number; currency: string }
  >();
  for (const m of forecast) {
    let group = byYear.get(m.year);
    if (!group) {
      group = { months: [], totalRevenue: 0, currency: m.currency };
      byYear.set(m.year, group);
    }
    group.months.push(m);
    group.totalRevenue += m.revenue;
    group.currency = m.currency;
  }
  return Array.from(byYear.entries())
    .map(([year, { months, totalRevenue, currency }]) => ({
      year,
      months: months.sort((a, b) => a.month - b.month),
      totalRevenue,
      currency,
    }))
    .sort((a, b) => a.year - b.year);
}

export function RevenueForecastPanel({ forecast, currentYear }: Props) {
  const yearGroups = useMemo(() => groupForecastByYear(forecast), [forecast]);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(
    () => new Set([currentYear])
  );
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleMonth = (key: string) => {
    setExpandedMonth((prev) => (prev === key ? null : key));
  };

  return (
    <Panel>
      <div
        className={`flex items-center gap-2 border-b ${panelHeaderBorder} bg-bg-muted/40 px-4 py-3`}
      >
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
          <BarChart3 className="h-4 w-4" />
          Planned revenue (forecast)
        </h2>
      </div>
      <div className="p-5">
        {forecast.length === 0 ? (
          <p className="text-sm text-text-primary opacity-70">
            No allocations with customer rates in the selected range.
          </p>
        ) : (
          <div className="space-y-2">
            {yearGroups.map(({ year, months, totalRevenue, currency }) => {
              const isYearExpanded = expandedYears.has(year);
              return (
                <div
                  key={year}
                  className="rounded-lg border border-panel bg-bg-default overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleYear(year)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg-muted/50 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      {isYearExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      {year}
                    </span>
                    <span className="text-sm tabular-nums text-text-primary font-medium">
                      {formatRevenue(totalRevenue, currency)}
                    </span>
                  </button>
                  {isYearExpanded && (
                    <div className="border-t border-panel">
                      <div className="bg-bg-muted/20">
                        {months.map(({ year: y, month, revenue, currency: mCurrency, byCustomer }) => {
                          const key = monthKey(y, month);
                          const isMonthExpanded = expandedMonth === key;
                          return (
                            <div
                              key={key}
                              className="border-t border-panel first:border-t-0"
                            >
                              <button
                                type="button"
                                onClick={() => toggleMonth(key)}
                                className="flex w-full items-center justify-between px-3 py-2 pl-8 text-left hover:bg-bg-muted/50 transition-colors"
                              >
                                <span className="flex items-center gap-2 text-sm text-text-primary">
                                  {isMonthExpanded ? (
                                    <ChevronDown className="h-4 w-4 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 shrink-0" />
                                  )}
                                  {getMonthLabel(month, y)}
                                </span>
                                <span className="text-sm tabular-nums text-text-primary">
                                  {formatRevenue(revenue, mCurrency)}
                                </span>
                              </button>
                              {isMonthExpanded && byCustomer.length > 0 && (
                                <div className="border-t border-panel bg-bg-muted/30 px-3 py-2 pl-14">
                                  <ul className="space-y-1.5">
                                    {byCustomer.map(
                                      ({
                                        customerId,
                                        customerName,
                                        revenue: custRevenue,
                                      }) => (
                                        <li
                                          key={customerId}
                                          className="flex items-center justify-between text-sm"
                                        >
                                          <span className="text-text-primary opacity-90">
                                            {customerName}
                                          </span>
                                          <span className="tabular-nums text-text-primary">
                                            {formatRevenue(
                                              custRevenue,
                                              mCurrency
                                            )}
                                          </span>
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between border-t-2 border-panel bg-bg-muted/40 px-3 py-2 pl-8">
                        <span className="text-sm font-medium text-text-primary">
                          Sum {year}
                        </span>
                        <span className="text-sm tabular-nums font-medium text-text-primary">
                          {formatRevenue(totalRevenue, currency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
