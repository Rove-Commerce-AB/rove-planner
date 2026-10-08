import type { WorkSprint } from "@/lib/workTypes";

/** Soft UI limit for optional sprint subtitle (not enforced in DB). */
export const WORK_SPRINT_TITLE_MAX_LENGTH = 50;

export function workSprintLabel(sprint: Pick<WorkSprint, "number" | "title">): string {
  const base = `Sprint ${sprint.number}`;
  const title = sprint.title.trim();
  return title ? `${base} · ${title}` : base;
}

export function clampWorkSprintTitle(raw: string): string {
  return raw.trim().slice(0, WORK_SPRINT_TITLE_MAX_LENGTH);
}
