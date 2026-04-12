"use server";

import * as q from "./consultantsQueries";

export type {
  ConsultantListItem,
  CreateConsultantInput,
  UpdateConsultantInput,
  ConsultantForEdit,
} from "./consultantsQueries";

export async function createConsultant(input: q.CreateConsultantInput) {
  return q.createConsultantQuery(input);
}

export async function updateConsultant(
  id: string,
  input: q.UpdateConsultantInput
) {
  return q.updateConsultantQuery(id, input);
}

export async function getConsultantById(id: string) {
  return q.fetchConsultantById(id);
}

export async function getConsultantsWithDefaultRole() {
  return q.fetchConsultantsWithDefaultRole();
}

export async function getConsultantsList() {
  return q.fetchConsultantsList();
}

export async function getConsultantNamesByIds(ids: string[]) {
  return q.fetchConsultantNamesByIds(ids);
}

export async function getAvailableHoursForConsultantWeek(
  consultantId: string,
  year: number,
  week: number
) {
  return q.fetchAvailableHoursForConsultantWeek(consultantId, year, week);
}

export async function getConsultantsWithDetails(year: number, week: number) {
  return q.fetchConsultantsWithDetails(year, week);
}
