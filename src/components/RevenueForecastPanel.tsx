import { BarChart3 } from "lucide-react";
import type { RevenueForecastMonth } from "@/lib/revenueForecast";
import { getMonthLabel } from "@/lib/dateUtils";
import { Panel } from "@/components/ui";

type Props = {
  forecast: RevenueForecastMonth[];
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

export function RevenueForecastPanel({ forecast }: Props) {
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
            {forecast.map(({ year, month, revenue, currency }) => (
              <div
                key={`${year}-${month}`}
                className="flex items-center justify-between rounded-lg border border-panel bg-bg-default px-3 py-2"
              >
                <span className="text-sm font-medium text-text-primary">
                  {getMonthLabel(month, year)}
                </span>
                <span className="text-sm tabular-nums text-text-primary">
                  {formatRevenue(revenue, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
