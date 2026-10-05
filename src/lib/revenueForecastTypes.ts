export type RevenueForecastByCustomer = {
  customerId: string;
  customerName: string;
  revenue: number;
  currency: string;
};

export type RevenueForecastMonth = {
  year: number;
  month: number;
  revenue: number;
  currency: string;
  byCustomer: RevenueForecastByCustomer[];
};
