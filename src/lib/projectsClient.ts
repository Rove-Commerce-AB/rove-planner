"use server";

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

export async function getProjectWithDetailsById(id: string) {
  return q.fetchProjectWithDetailsById(id);
}

export async function getUniqueJiraAndDevopsProjects() {
  return q.fetchUniqueJiraAndDevopsProjects();
}

export async function getProjects() {
  return q.fetchProjects();
}

export async function getProjectsWithCustomer(ids: string[] = []) {
  return q.fetchProjectsWithCustomer(ids);
}

export async function getProjectsAvailableForConsultant(
  consultantId: string | null
) {
  return q.fetchProjectsAvailableForConsultant(consultantId);
}

export async function getProjectsByIds(ids: string[]) {
  return q.fetchProjectsByIds(ids);
}
