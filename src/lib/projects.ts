import "server-only";

import * as q from "./projectsQueries";

export type {
  ProjectRecord,
  CreateProjectInput,
  UpdateProjectInput,
  IntegrationProjectOption,
  ProjectWithCustomer,
} from "./projectsQueries";

export async function createProject(input: q.CreateProjectInput) {
  return q.createProjectQuery(input);
}

export async function updateProject(id: string, input: q.UpdateProjectInput) {
  return q.updateProjectQuery(id, input);
}

export async function deleteProject(id: string) {
  return q.deleteProjectQuery(id);
}

export async function getUniqueJiraAndDevopsProjects() {
  return q.fetchUniqueJiraAndDevopsProjects();
}

export async function getProjectWithDetailsById(id: string) {
  return q.fetchProjectWithDetailsById(id);
}

export async function getProjects() {
  return q.fetchProjects();
}

export async function getProjectsWithDetails() {
  return q.fetchProjectsWithDetails();
}

export async function getProjectsByCustomerIds(customerIds: string[]) {
  return q.fetchProjectsByCustomerIds(customerIds);
}

export async function getProjectsByIds(ids: string[]) {
  return q.fetchProjectsByIds(ids);
}

export async function getProjectsWithCustomerNames(ids: string[]) {
  return q.fetchProjectsWithCustomerNames(ids);
}

export async function getProjectsWithCustomer(ids: string[] = []) {
  return q.fetchProjectsWithCustomer(ids);
}

export async function getProjectsAvailableForConsultant(
  consultantId: string | null
) {
  return q.fetchProjectsAvailableForConsultant(consultantId);
}
