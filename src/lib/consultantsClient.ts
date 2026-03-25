import { createClient } from "@/lib/supabase/client";
import * as q from "./consultantsQueries";

export type {
  ConsultantListItem,
  CreateConsultantInput,
  UpdateConsultantInput,
  ConsultantForEdit,
} from "./consultantsQueries";

export async function createConsultant(input: q.CreateConsultantInput) {
  const supabase = createClient();
  return q.createConsultantQuery(supabase, input);
}

export async function updateConsultant(
  id: string,
  input: q.UpdateConsultantInput
) {
  const supabase = createClient();
  return q.updateConsultantQuery(supabase, id, input);
}

export async function deleteConsultant(id: string) {
  const supabase = createClient();
  return q.deleteConsultantQuery(supabase, id);
}

export async function getConsultantById(id: string) {
  const supabase = createClient();
  return q.fetchConsultantById(supabase, id);
}

export async function getConsultantsWithDefaultRole() {
  const supabase = createClient();
  return q.fetchConsultantsWithDefaultRole(supabase);
}

export async function getConsultantsList() {
  const supabase = createClient();
  return q.fetchConsultantsList(supabase);
}

export async function getConsultantNamesByIds(ids: string[]) {
  const supabase = createClient();
  return q.fetchConsultantNamesByIds(supabase, ids);
}

export async function getAvailableHoursForConsultantWeek(
  consultantId: string,
  year: number,
  week: number
) {
  const supabase = createClient();
  return q.fetchAvailableHoursForConsultantWeek(
    supabase,
    consultantId,
    year,
    week
  );
}

export async function getConsultantsWithDetails(year: number, week: number) {
  const supabase = createClient();
  return q.fetchConsultantsWithDetails(supabase, year, week);
}
