import "server-only";

import { requireVisibleWorkBoard } from "@/lib/workBoards";
import {
  addWorkIssueAssignee,
  deleteWorkIssueFile,
  fetchWorkIssueStatus,
  findOrCreateBoardLabel,
  insertWorkIssue,
  insertWorkIssueComment,
  insertWorkIssueEvent,
  insertWorkIssueFile,
  linkWorkIssueLabel,
  moveWorkIssue,
  removeWorkIssueAssignee,
  reorderWorkIssuesInStatus,
  unlinkWorkIssueLabel,
  updateWorkIssueField,
  updateWorkIssueOwner,
  updateWorkIssueTitle,
} from "@/lib/workIssuesQueries";
import { WORK_FILE_MAX_BYTES } from "@/lib/workTypes";
import type { WorkIssueStatus } from "@/lib/workStatuses";
import { fetchWorkBoardStatuses } from "@/lib/workBoardsQueries";

export { WORK_FILE_MAX_BYTES };

async function requireBoardAccess(boardId: string) {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Unauthorized");
  return visible;
}

async function logEvent(
  issueId: string,
  actorAppUserId: string,
  kind: string,
  summary: string
) {
  await insertWorkIssueEvent({ issueId, actorAppUserId, kind, summary });
}

export async function createWorkIssue(input: {
  boardId: string;
  title: string;
  status: WorkIssueStatus;
}): Promise<string> {
  const { actor } = await requireBoardAccess(input.boardId);
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  await assertBoardStatus(input.boardId, input.status);
  return insertWorkIssue({
    boardId: input.boardId,
    title,
    status: input.status,
    createdByAppUserId: actor.id,
  });
}

export async function setWorkIssueTitle(
  boardId: string,
  issueId: string,
  title: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");
  const ok = await updateWorkIssueTitle(boardId, issueId, trimmed);
  if (!ok) throw new Error("Issue not found");
  await logEvent(issueId, actor.id, "title", `changed the title to “${trimmed}”`);
}

export async function setWorkIssueOwner(
  boardId: string,
  issueId: string,
  ownerAppUserId: string | null,
  ownerName: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const ok = await updateWorkIssueOwner(boardId, issueId, ownerAppUserId);
  if (!ok) throw new Error("Issue not found");
  await logEvent(
    issueId,
    actor.id,
    "owner",
    ownerAppUserId
      ? `changed the owner to ${ownerName}`
      : "cleared the owner"
  );
}

export async function setWorkIssueTextField(
  boardId: string,
  issueId: string,
  field: "description" | "current_state" | "next_step",
  value: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const ok = await updateWorkIssueField(boardId, issueId, field, value);
  if (!ok) throw new Error("Issue not found");
  const labels = {
    description: "description",
    current_state: "current state",
    next_step: "next step",
  } as const;
  await logEvent(
    issueId,
    actor.id,
    field,
    `updated the ${labels[field]}`
  );
}

export async function addIssueAssignee(
  boardId: string,
  issueId: string,
  appUserId: string,
  personName: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  await addWorkIssueAssignee(issueId, appUserId);
  await logEvent(issueId, actor.id, "assignees", `assigned ${personName}`);
}

export async function removeIssueAssignee(
  boardId: string,
  issueId: string,
  appUserId: string,
  personName: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  await removeWorkIssueAssignee(issueId, appUserId);
  await logEvent(issueId, actor.id, "assignees", `unassigned ${personName}`);
}

export async function addIssueLabel(
  boardId: string,
  issueId: string,
  name: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Label is required");
  const label = await findOrCreateBoardLabel(boardId, trimmed);
  await linkWorkIssueLabel(issueId, label.id);
  await logEvent(issueId, actor.id, "labels", `added label “${label.name}”`);
}

export async function removeIssueLabel(
  boardId: string,
  issueId: string,
  labelId: string,
  labelName: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  await unlinkWorkIssueLabel(issueId, labelId);
  await logEvent(issueId, actor.id, "labels", `removed label “${labelName}”`);
}

export async function addIssueComment(
  boardId: string,
  issueId: string,
  body: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment is required");
  await insertWorkIssueComment({
    issueId,
    authorAppUserId: actor.id,
    body: trimmed,
  });
  await logEvent(issueId, actor.id, "comment", "added a comment");
}

export async function setWorkIssueStatus(
  boardId: string,
  issueId: string,
  status: WorkIssueStatus,
  sortOrder: number
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const statuses = await assertBoardStatus(boardId, status);
  const previous = await fetchWorkIssueStatus(boardId, issueId);
  const ok = await moveWorkIssue({
    boardId,
    issueId,
    status,
    sortOrder,
  });
  if (!ok) throw new Error("Issue not found");
  if (previous && previous !== status) {
    const nextName =
      statuses.find((row) => row.id === status)?.name ?? "a new status";
    await logEvent(
      issueId,
      actor.id,
      "status",
      `changed status to ${nextName}`
    );
  }
}

export async function reorderWorkIssues(
  boardId: string,
  status: WorkIssueStatus,
  issueIds: string[]
): Promise<void> {
  await requireBoardAccess(boardId);
  await assertBoardStatus(boardId, status);
  await reorderWorkIssuesInStatus({ boardId, status, issueIds });
}

async function assertBoardStatus(boardId: string, statusId: string) {
  const statuses = await fetchWorkBoardStatuses(boardId);
  if (!statuses.some((status) => status.id === statusId)) {
    throw new Error("Invalid status");
  }
  return statuses;
}

export async function uploadIssueFile(
  boardId: string,
  issueId: string,
  file: { name: string; type: string; size: number; bytes: Uint8Array }
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const fileName = file.name.trim() || "file";
  if (file.size <= 0) throw new Error("File is empty");
  if (file.size > WORK_FILE_MAX_BYTES) {
    throw new Error("File must be 8 MB or smaller");
  }
  await insertWorkIssueFile({
    issueId,
    fileName,
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
    content: Buffer.from(file.bytes),
    uploadedByAppUserId: actor.id,
  });
  await logEvent(issueId, actor.id, "file", `uploaded ${fileName}`);
}

export async function removeIssueFile(
  boardId: string,
  issueId: string,
  fileId: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const fileName = await deleteWorkIssueFile(issueId, fileId);
  if (!fileName) throw new Error("File not found");
  await logEvent(issueId, actor.id, "file", `removed ${fileName}`);
}
