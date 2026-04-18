export const USER_NOTIFICATION_KIND = {
  ALLOCATION_BOOKED: "allocation_booked",
  FEATURE_REQUEST_IMPLEMENTED: "feature_request_implemented",
} as const;

export type UserNotificationKind =
  (typeof USER_NOTIFICATION_KIND)[keyof typeof USER_NOTIFICATION_KIND];

export type UserNotificationRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type AllocationInsertForNotify = {
  id: string;
  consultant_id: string | null;
  project_id: string;
  year: number;
  week: number;
  hours: number;
};
