import "server-only";

import { getCurrentAppUser } from "@/lib/appUsers";
import { requireVisibleWorkBoard } from "@/lib/workBoards";
import { workIssueKey } from "@/lib/workIssueKey";
import {
  addWorkIssueAssignee,
  deleteWorkIssueFile,
  fetchWorkIssueNotifyMeta,
  fetchWorkIssueStatus,
  findOrCreateBoardLabel,
  insertWorkIssue,
  deleteWorkIssueComment,
  deleteWorkIssueRelation,
  fetchWorkIssueRelations,
  insertWorkIssueComment,
  insertWorkIssueEvent,
  insertWorkIssueFile,
  insertWorkIssueRelation,
  insertWorkIssueRequirement,
  insertWorkIssueReference,
  linkWorkIssueLabel,
  moveWorkIssue,
  removeWorkIssueAssignee,
  reorderWorkIssuesInStatus,
  unlinkWorkIssueLabel,
  updateWorkIssueComment,
  updateWorkIssueEstimate,
  updateWorkIssueField,
  updateWorkIssueOwner,
  updateWorkIssuePriority,
  updateWorkIssueRequirementBody,
  updateWorkIssueRequirementDone,
  deleteWorkIssueRequirement,
  deleteWorkIssueReference,
  updateWorkIssueTitle,
} from "@/lib/workIssuesQueries";
import { commentPreview, extractMentionedIds } from "@/lib/workMentions";
import {
  childAlreadyHasParent,
  relationEdgeFromRole,
  relationEventSummary,
  wouldCreateBlocksCycle,
  wouldCreateParentCycle,
  type WorkRelationRole,
} from "@/lib/workIssueRelations";
import { USER_NOTIFICATION_KIND } from "@/lib/userNotificationKinds";
import { insertUserNotification } from "@/lib/userNotifications";
import { WORK_FILE_MAX_BYTES, type WorkIssuePriority, type WorkRequirementKind } from "@/lib/workTypes";
import { formatWorkHours, parseWorkEstimateHours } from "@/lib/workTime";
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
    ownerAppUserId: actor.id,
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
  field: "description" | "current_state" | "next_step" | "out_of_scope",
  value: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const ok = await updateWorkIssueField(boardId, issueId, field, value);
  if (!ok) throw new Error("Issue not found");
  const labels = {
    description: "description",
    current_state: "current state",
    next_step: "next step",
    out_of_scope: "out of scope",
  } as const;
  await logEvent(
    issueId,
    actor.id,
    field,
    `updated the ${labels[field]}`
  );
}

export async function setWorkIssueEstimate(
  boardId: string,
  issueId: string,
  rawHours: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const parsed = parseWorkEstimateHours(rawHours);
  if (!parsed.ok) throw new Error("Estimate must be a number of hours");
  const ok = await updateWorkIssueEstimate(boardId, issueId, parsed.value);
  if (!ok) throw new Error("Issue not found");
  await logEvent(
    issueId,
    actor.id,
    "estimate",
    parsed.value == null
      ? "cleared the estimate"
      : `set the estimate to ${formatWorkHours(parsed.value)}`
  );
}

export async function setWorkIssuePriority(
  boardId: string,
  issueId: string,
  priority: WorkIssuePriority | null
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const ok = await updateWorkIssuePriority(boardId, issueId, priority);
  if (!ok) throw new Error("Issue not found");
  await logEvent(
    issueId,
    actor.id,
    "priority",
    priority == null ? "cleared the priority" : `set priority to ${priority}`
  );
}

export async function addIssueRequirement(
  boardId: string,
  issueId: string,
  body: string,
  kind: WorkRequirementKind = "acceptance"
): Promise<{ id: string; sortOrder: number }> {
  const { actor } = await requireBoardAccess(boardId);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Requirement text is required");
  const created = await insertWorkIssueRequirement({
    issueId,
    body: trimmed,
    kind,
  });
  await logEvent(
    issueId,
    actor.id,
    "requirement",
    kind === "dod"
      ? "added a definition-of-done item"
      : "added a requirement"
  );
  return created;
}

export async function setIssueRequirementBody(
  boardId: string,
  issueId: string,
  requirementId: string,
  body: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Requirement text is required");
  const ok = await updateWorkIssueRequirementBody(
    issueId,
    requirementId,
    trimmed
  );
  if (!ok) throw new Error("Requirement not found");
  await logEvent(issueId, actor.id, "requirement", "updated a requirement");
}

export async function setIssueRequirementDone(
  boardId: string,
  issueId: string,
  requirementId: string,
  isDone: boolean
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const ok = await updateWorkIssueRequirementDone(
    issueId,
    requirementId,
    isDone
  );
  if (!ok) throw new Error("Requirement not found");
  await logEvent(
    issueId,
    actor.id,
    "requirement",
    isDone ? "checked a requirement" : "unchecked a requirement"
  );
}

export async function removeIssueRequirement(
  boardId: string,
  issueId: string,
  requirementId: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const ok = await deleteWorkIssueRequirement(issueId, requirementId);
  if (!ok) throw new Error("Requirement not found");
  await logEvent(issueId, actor.id, "requirement", "removed a requirement");
}

function normalizeReferenceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("URL is required");
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Enter a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://");
  }
  return url.toString();
}

export async function addIssueReference(
  boardId: string,
  issueId: string,
  url: string,
  label: string
): Promise<{ id: string; sortOrder: number }> {
  const { actor } = await requireBoardAccess(boardId);
  const normalized = normalizeReferenceUrl(url);
  const created = await insertWorkIssueReference({
    issueId,
    url: normalized,
    label: label.trim(),
  });
  await logEvent(issueId, actor.id, "reference", "added a reference");
  return created;
}

export async function removeIssueReference(
  boardId: string,
  issueId: string,
  referenceId: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const ok = await deleteWorkIssueReference(issueId, referenceId);
  if (!ok) throw new Error("Reference not found");
  await logEvent(issueId, actor.id, "reference", "removed a reference");
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
  const visible = await requireBoardAccess(boardId);
  const { actor, board } = visible;
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment is required");
  await insertWorkIssueComment({
    issueId,
    authorAppUserId: actor.id,
    body: trimmed,
  });
  await logEvent(issueId, actor.id, "comment", "added a comment");
  await notifyWorkIssueMentions({
    boardId,
    issueId,
    body: trimmed,
    actorId: actor.id,
    memberIds: board.member_ids,
    customerId: board.customer_id,
    boardTitle: board.title,
    boardPrefix: board.prefix,
  });
}

export async function updateIssueComment(
  boardId: string,
  issueId: string,
  commentId: string,
  body: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment is required");
  const ok = await updateWorkIssueComment({
    commentId,
    issueId,
    authorAppUserId: actor.id,
    body: trimmed,
  });
  if (!ok) throw new Error("Comment not found");
  await logEvent(issueId, actor.id, "comment", "edited a comment");
}

export async function deleteIssueComment(
  boardId: string,
  issueId: string,
  commentId: string
): Promise<void> {
  const { actor } = await requireBoardAccess(boardId);
  const ok = await deleteWorkIssueComment({
    commentId,
    issueId,
    authorAppUserId: actor.id,
  });
  if (!ok) throw new Error("Comment not found");
  await logEvent(issueId, actor.id, "comment", "deleted a comment");
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
): Promise<string> {
  const { actor } = await requireBoardAccess(boardId);
  const fileName = file.name.trim() || "file";
  if (file.size <= 0) throw new Error("File is empty");
  if (file.size > WORK_FILE_MAX_BYTES) {
    throw new Error("File must be 8 MB or smaller");
  }
  const fileId = await insertWorkIssueFile({
    issueId,
    fileName,
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
    content: Buffer.from(file.bytes),
    uploadedByAppUserId: actor.id,
  });
  await logEvent(issueId, actor.id, "file", `uploaded ${fileName}`);
  return fileId;
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

async function notifyWorkIssueMentions(input: {
  boardId: string;
  issueId: string;
  body: string;
  actorId: string;
  memberIds: readonly string[];
  customerId: string;
  boardTitle: string;
  boardPrefix: string;
}): Promise<void> {
  const mentioned = extractMentionedIds(input.body).filter(
    (id) => id !== input.actorId && input.memberIds.includes(id)
  );
  if (mentioned.length === 0) return;
  try {
    const [issue, user] = await Promise.all([
      fetchWorkIssueNotifyMeta(input.boardId, input.issueId),
      getCurrentAppUser(),
    ]);
    if (!issue) return;
    const mentionerName = user?.name?.trim() || user?.email || "Someone";
    const payload = {
      customerId: input.customerId,
      boardId: input.boardId,
      boardTitle: input.boardTitle,
      issueId: input.issueId,
      issueKey: workIssueKey(input.boardPrefix, issue.number),
      issueTitle: issue.title,
      mentionerName,
      commentPreview: commentPreview(input.body),
    };
    await Promise.all(
      mentioned.map((appUserId) =>
        insertUserNotification(
          appUserId,
          USER_NOTIFICATION_KIND.WORK_ISSUE_MENTIONED,
          payload
        )
      )
    );
  } catch (error) {
    console.warn("[work] mention notification failed", error);
  }
}

export async function addIssueRelation(
  boardId: string,
  issueId: string,
  otherIssueId: string,
  role: WorkRelationRole
): Promise<void> {
  const { actor, board } = await requireBoardAccess(boardId);
  if (issueId === otherIssueId) throw new Error("An issue cannot relate to itself");
  const edge = relationEdgeFromRole(issueId, otherIssueId, role);
  const rows = (await fetchWorkIssueRelations(boardId)).map((row) => ({
    id: row.id,
    boardId: row.board_id,
    fromIssueId: row.from_issue_id,
    toIssueId: row.to_issue_id,
    kind: row.kind,
  }));
  if (edge.kind === "parent") {
    if (childAlreadyHasParent(rows, edge.toIssueId)) {
      throw new Error("That issue already has a parent");
    }
    if (wouldCreateParentCycle(rows, edge.fromIssueId, edge.toIssueId)) {
      throw new Error("That parent would create a cycle");
    }
  }
  if (edge.kind === "blocks") {
    if (wouldCreateBlocksCycle(rows, edge.fromIssueId, edge.toIssueId)) {
      throw new Error("That block would create a cycle");
    }
  }
  try {
    await insertWorkIssueRelation({
      boardId,
      fromIssueId: edge.fromIssueId,
      toIssueId: edge.toIssueId,
      kind: edge.kind,
    });
  } catch (error) {
    const maybePg = error as { code?: string };
    if (maybePg.code === "23505") {
      throw new Error("That relation already exists");
    }
    throw error;
  }
  const other = await fetchWorkIssueNotifyMeta(boardId, otherIssueId);
  const otherKey = other
    ? workIssueKey(board.prefix, other.number)
    : "another issue";
  await logEvent(
    issueId,
    actor.id,
    "relation",
    relationEventSummary(role, otherKey)
  );
}

export async function removeIssueRelation(
  boardId: string,
  issueId: string,
  relationId: string
): Promise<void> {
  const { actor, board } = await requireBoardAccess(boardId);
  const removed = await deleteWorkIssueRelation(boardId, relationId);
  if (!removed) throw new Error("Relation not found");
  const otherId =
    removed.fromIssueId === issueId ? removed.toIssueId : removed.fromIssueId;
  const other = await fetchWorkIssueNotifyMeta(boardId, otherId);
  const otherKey = other
    ? workIssueKey(board.prefix, other.number)
    : "another issue";
  await logEvent(
    issueId,
    actor.id,
    "relation",
    `removed a relation to ${otherKey}`
  );
}
