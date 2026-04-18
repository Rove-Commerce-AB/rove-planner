"use server";

import {
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from "@/lib/userNotifications";

export async function markDashboardNotificationReadAction(
  notificationId: string
): Promise<void> {
  await markUserNotificationRead(notificationId);
}

export async function markAllDashboardNotificationsReadAction(): Promise<void> {
  await markAllUserNotificationsRead();
}
