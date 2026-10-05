export const BILLING_CURRENCIES = ["SEK", "EUR"] as const;

export type BillingCurrency = (typeof BILLING_CURRENCIES)[number];

export const DEFAULT_BILLING_CURRENCY: BillingCurrency = "SEK";

export function parseBillingCurrency(
  value: string | null | undefined
): BillingCurrency {
  const normalized = (value ?? "").trim().toUpperCase();
  return BILLING_CURRENCIES.includes(normalized as BillingCurrency)
    ? (normalized as BillingCurrency)
    : DEFAULT_BILLING_CURRENCY;
}

export function hourlyRateLabel(currency: string): string {
  return `Hourly rate (${parseBillingCurrency(currency)})`;
}

export function hourlyRateSuffix(currency: string): string {
  return `${parseBillingCurrency(currency)}/h`;
}

export function moneyLabel(currency: string): string {
  return parseBillingCurrency(currency);
}
