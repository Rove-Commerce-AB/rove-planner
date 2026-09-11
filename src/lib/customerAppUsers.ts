import "server-only";

import * as q from "./customerAppUsersQueries";

export type {
  CustomerAppUser,
  CustomerAppUsersByCustomerId,
  PersonCustomerLink,
} from "./customerAppUsersQueries";

export async function getCustomerUsersByCustomerIds(customerIds: string[]) {
  return q.getCustomerUsersByCustomerIds(customerIds);
}

export async function getCustomerUsers() {
  return q.getCustomerUsers();
}

export async function getCustomersForAppUser(appUserId: string) {
  return q.getCustomersForAppUser(appUserId);
}

export async function getCustomersForConsultantIds(consultantIds: string[]) {
  return q.getCustomersForConsultantIds(consultantIds);
}

export async function getCustomersForAppUserIds(appUserIds: string[]) {
  return q.getCustomersForAppUserIds(appUserIds);
}
