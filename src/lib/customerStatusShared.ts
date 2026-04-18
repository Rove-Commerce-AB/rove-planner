/** Types and constants shared by server and client (no `server-only`). */

export const CUSTOMER_STATUS_BODY_MAX_LENGTH = 500;

export type TrafficLight = "red" | "yellow" | "green";

export type CustomerStatusEntrySerialized = {
  id: string;
  traffic_light: TrafficLight;
  body: string;
  year: number;
  week: number;
  created_at: string;
};

export type CustomerStatusRowProps = {
  customerId: string;
  customerName: string;
  latest: CustomerStatusEntrySerialized | null;
};
