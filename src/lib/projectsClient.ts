import { createClient } from "@/lib/supabase/client";
import * as q from "./projectsQueries";

export type {
  ProjectRecord,
  CreateProjectInput,
  UpdateProjectInput,
  IntegrationProjectOption,
  ProjectWithCustomer,
} from "./projectsQueries";

export async function createProject(input: q.CreateProjectInput) {
  const supabase = createClient();
  return q.createProjectQuery(supabase, input);
}

export async function updateProject(id: string, input: q.UpdateProjectInput) {
  const supabase = createClient();
  return q.updateProjectQuery(supabase, id, input);
}

export async function deleteProject(id: string) {
  const supabase = createClient();
  return q.deleteProjectQuery(supabase, id);
}

export async function getProjectWithDetailsById(id: string) {
  const supabase = createClient();
  return q.fetchProjectWithDetailsById(supabase, id);
}

export async function getUniqueJiraAndDevopsProjects() {
  const supabase = createClient();
  return q.fetchUniqueJiraAndDevopsProjects(supabase);
}

export async function getProjects() {
  const supabase = createClient();
  return q.fetchProjects(supabase);
}

export async function getProjectsWithCustomer(ids: string[] = []) {
  const supabase = createClient();
  return q.fetchProjectsWithCustomer(supabase, ids);
}

export async function getProjectsAvailableForConsultant(
  consultantId: string | null
) {
  const supabase = createClient();
  return q.fetchProjectsAvailableForConsultant(supabase, consultantId);
}

export async function getProjectsByIds(ids: string[]) {
  const supabase = createClient();
  return q.fetchProjectsByIds(supabase, ids);
}
