import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./projectsQueries";

export type {
  ProjectRecord,
  CreateProjectInput,
  UpdateProjectInput,
  IntegrationProjectOption,
  ProjectWithCustomer,
} from "./projectsQueries";

export async function createProject(input: q.CreateProjectInput) {
  const supabase = await createClient();
  return q.createProjectQuery(supabase, input);
}

export async function updateProject(id: string, input: q.UpdateProjectInput) {
  const supabase = await createClient();
  return q.updateProjectQuery(supabase, id, input);
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  return q.deleteProjectQuery(supabase, id);
}

export async function getUniqueJiraAndDevopsProjects() {
  const supabase = await createClient();
  return q.fetchUniqueJiraAndDevopsProjects(supabase);
}

export async function getProjectWithDetailsById(id: string) {
  const supabase = await createClient();
  return q.fetchProjectWithDetailsById(supabase, id);
}

export async function getProjects() {
  const supabase = await createClient();
  return q.fetchProjects(supabase);
}

export async function getProjectsWithDetails() {
  const supabase = await createClient();
  return q.fetchProjectsWithDetails(supabase);
}

export async function getProjectsByCustomerIds(customerIds: string[]) {
  const supabase = await createClient();
  return q.fetchProjectsByCustomerIds(supabase, customerIds);
}

export async function getProjectsByIds(ids: string[]) {
  const supabase = await createClient();
  return q.fetchProjectsByIds(supabase, ids);
}

export async function getProjectsWithCustomerNames(ids: string[]) {
  const supabase = await createClient();
  return q.fetchProjectsWithCustomerNames(supabase, ids);
}

export async function getProjectsWithCustomer(ids: string[] = []) {
  const supabase = await createClient();
  return q.fetchProjectsWithCustomer(supabase, ids);
}

export async function getProjectsAvailableForConsultant(
  consultantId: string | null
) {
  const supabase = await createClient();
  return q.fetchProjectsAvailableForConsultant(supabase, consultantId);
}
