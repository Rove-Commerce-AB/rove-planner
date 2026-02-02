import type { RevenueForecastMonth } from "@/lib/revenueForecast";
import { getMonthLabel } from "@/lib/dateUtils";

type Props = {
  forecast: RevenueForecastMonth[];
};

function formatRevenue(value: number, currency: string): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + " " + currency;
}

export function RevenueForecastPanel({ forecast }: Props) {
  return (
    <div className="rounded-lg border border-border bg-bg-default p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">
        Planerad intäkt (prognos)
      </h2>
      {forecast.length === 0 ? (
        <p className="text-sm text-text-primary opacity-70">
          Inga allokeringar med kundpriser i valt intervall.
        </p>
      ) : (
        <div className="space-y-2">
          {forecast.map(({ year, month, revenue, currency }) => (
            <div
              key={`${year}-${month}`}
              className="flex items-center justify-between rounded-md border border-panel bg-bg-muted/30 px-3 py-2"
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
  );
}
