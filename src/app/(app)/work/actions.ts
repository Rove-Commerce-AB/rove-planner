"use server";

import { revalidatePath } from "next/cache";
import {
  addWorkBoardMember,
  archiveWorkBoard,
  createWorkBoard,
  createWorkBoardStatus,
  deleteWorkBoardStatus,
  listWorkCustomerPeople,
  removeWorkBoardMember,
  renameWorkBoard,
  renameWorkBoardStatus,
  reorderWorkBoardStatuses,
  restoreWorkBoard,
} from "@/lib/workBoards";
import type { WorkBoardStatus } from "@/lib/workStatuses";
import type { WorkIssuePriority, WorkPerson, WorkRequirementKind } from "@/lib/workTypes";
import {
  addIssueAssignee,
  addIssueComment,
  addIssueLabel,
  addIssueRelation,
  addIssueRequirement,
  addIssueReference,
  deleteIssueComment,
  createWorkIssue,
  removeIssueAssignee,
  removeIssueFile,
  removeIssueLabel,
  removeIssueRelation,
  removeIssueRequirement,
  removeIssueReference,
  reorderWorkIssues,
  setIssueRequirementBody,
  setIssueRequirementDone,
  setWorkIssueEstimate,
  setWorkIssueOwner,
  setWorkIssuePriority,
  updateIssueComment,
  setWorkIssueStatus,
  setWorkIssueTextField,
  setWorkIssueTitle,
  uploadIssueFile,
} from "@/lib/workIssues";
import { ROUTES, workCustomerHref } from "@/lib/routes";
import type { WorkIssueStatus } from "@/lib/workStatuses";
import type { WorkRelationRole } from "@/lib/workIssueRelations";

type Ok = { ok: true };
type OkBoard = { ok: true; boardId: string };
type OkIssue = { ok: true; issueId: string };
type Err = { ok: false; error: string };

function fail(error: unknown): Err {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong",
  };
}

function revalidateBoard(_boardId?: string, _issueId?: string) {
  revalidatePath(ROUTES.work, "layout");
}

export async function listWorkCustomerPeopleAction(
  customerId: string
): Promise<WorkPerson[]> {
  try {
    return await listWorkCustomerPeople(customerId);
  } catch {
    return [];
  }
}

export async function createWorkBoardAction(
  customerId: string,
  title: string,
  prefix: string,
  memberAppUserIds?: string[]
): Promise<OkBoard | Err> {
  try {
    const boardId = await createWorkBoard(
      customerId,
      title,
      prefix,
      memberAppUserIds
    );
    revalidatePath(ROUTES.work, "layout");
    revalidatePath(workCustomerHref(customerId));
    return { ok: true, boardId };
  } catch (error) {
    return fail(error);
  }
}

export async function addWorkBoardMemberAction(
  boardId: string,
  appUserId: string
): Promise<Ok | Err> {
  try {
    await addWorkBoardMember(boardId, appUserId);
    revalidateBoard(boardId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeWorkBoardMemberAction(
  boardId: string,
  appUserId: string
): Promise<Ok | Err> {
  try {
    await removeWorkBoardMember(boardId, appUserId);
    revalidateBoard(boardId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function renameWorkBoardAction(
  boardId: string,
  title: string
): Promise<{ ok: true; title: string } | Err> {
  try {
    const renamed = await renameWorkBoard(boardId, title);
    revalidatePath(ROUTES.work, "layout");
    revalidatePath(workCustomerHref(renamed.customerId));
    return { ok: true, title: renamed.title };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveWorkBoardAction(
  boardId: string
): Promise<{ ok: true; customerId: string } | Err> {
  try {
    const customerId = await archiveWorkBoard(boardId);
    revalidatePath(ROUTES.work, "layout");
    revalidatePath(workCustomerHref(customerId));
    return { ok: true, customerId };
  } catch (error) {
    return fail(error);
  }
}

export async function restoreWorkBoardAction(
  boardId: string
): Promise<{ ok: true; customerId: string } | Err> {
  try {
    const customerId = await restoreWorkBoard(boardId);
    revalidatePath(ROUTES.work, "layout");
    revalidatePath(workCustomerHref(customerId));
    return { ok: true, customerId };
  } catch (error) {
    return fail(error);
  }
}

export async function createWorkBoardStatusAction(
  boardId: string,
  name: string
): Promise<{ ok: true; status: WorkBoardStatus } | Err> {
  try {
    const status = await createWorkBoardStatus(boardId, name);
    revalidateBoard(boardId);
    return { ok: true, status };
  } catch (error) {
    return fail(error);
  }
}

export async function renameWorkBoardStatusAction(
  boardId: string,
  statusId: string,
  name: string
): Promise<{ ok: true; status: WorkBoardStatus } | Err> {
  try {
    const status = await renameWorkBoardStatus(boardId, statusId, name);
    revalidateBoard(boardId);
    return { ok: true, status };
  } catch (error) {
    return fail(error);
  }
}

export async function reorderWorkBoardStatusesAction(
  boardId: string,
  statusIds: string[]
): Promise<Ok | Err> {
  try {
    await reorderWorkBoardStatuses(boardId, statusIds);
    revalidateBoard(boardId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteWorkBoardStatusAction(
  boardId: string,
  statusId: string,
  moveToStatusId: string | null
): Promise<Ok | Err> {
  try {
    await deleteWorkBoardStatus(boardId, statusId, moveToStatusId);
    revalidateBoard(boardId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function createWorkIssueAction(input: {
  boardId: string;
  title: string;
  status: WorkIssueStatus;
}): Promise<OkIssue | Err> {
  try {
    const issueId = await createWorkIssue(input);
    revalidateBoard(input.boardId, issueId);
    return { ok: true, issueId };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkIssueTitleAction(
  boardId: string,
  issueId: string,
  title: string
): Promise<Ok | Err> {
  try {
    await setWorkIssueTitle(boardId, issueId, title);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkIssueOwnerAction(
  boardId: string,
  issueId: string,
  ownerAppUserId: string | null,
  ownerName: string
): Promise<Ok | Err> {
  try {
    await setWorkIssueOwner(boardId, issueId, ownerAppUserId, ownerName);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkIssueFieldAction(
  boardId: string,
  issueId: string,
  field: "description" | "current_state" | "next_step" | "out_of_scope",
  value: string
): Promise<Ok | Err> {
  try {
    await setWorkIssueTextField(boardId, issueId, field, value);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkIssueEstimateAction(
  boardId: string,
  issueId: string,
  hours: string
): Promise<Ok | Err> {
  try {
    await setWorkIssueEstimate(boardId, issueId, hours);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkIssuePriorityAction(
  boardId: string,
  issueId: string,
  priority: WorkIssuePriority | null
): Promise<Ok | Err> {
  try {
    await setWorkIssuePriority(boardId, issueId, priority);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addWorkIssueRequirementAction(
  boardId: string,
  issueId: string,
  body: string,
  kind: WorkRequirementKind = "acceptance"
): Promise<(Ok & { id: string; sortOrder: number }) | Err> {
  try {
    const created = await addIssueRequirement(boardId, issueId, body, kind);
    revalidateBoard(boardId, issueId);
    return { ok: true, ...created };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkIssueRequirementBodyAction(
  boardId: string,
  issueId: string,
  requirementId: string,
  body: string
): Promise<Ok | Err> {
  try {
    await setIssueRequirementBody(boardId, issueId, requirementId, body);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkIssueRequirementDoneAction(
  boardId: string,
  issueId: string,
  requirementId: string,
  isDone: boolean
): Promise<Ok | Err> {
  try {
    await setIssueRequirementDone(boardId, issueId, requirementId, isDone);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteWorkIssueRequirementAction(
  boardId: string,
  issueId: string,
  requirementId: string
): Promise<Ok | Err> {
  try {
    await removeIssueRequirement(boardId, issueId, requirementId);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addWorkIssueReferenceAction(
  boardId: string,
  issueId: string,
  url: string,
  label: string
): Promise<(Ok & { id: string; sortOrder: number }) | Err> {
  try {
    const created = await addIssueReference(boardId, issueId, url, label);
    revalidateBoard(boardId, issueId);
    return { ok: true, ...created };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteWorkIssueReferenceAction(
  boardId: string,
  issueId: string,
  referenceId: string
): Promise<Ok | Err> {
  try {
    await removeIssueReference(boardId, issueId, referenceId);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addWorkIssueAssigneeAction(
  boardId: string,
  issueId: string,
  appUserId: string,
  personName: string
): Promise<Ok | Err> {
  try {
    await addIssueAssignee(boardId, issueId, appUserId, personName);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeWorkIssueAssigneeAction(
  boardId: string,
  issueId: string,
  appUserId: string,
  personName: string
): Promise<Ok | Err> {
  try {
    await removeIssueAssignee(boardId, issueId, appUserId, personName);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addWorkIssueLabelAction(
  boardId: string,
  issueId: string,
  name: string
): Promise<Ok | Err> {
  try {
    await addIssueLabel(boardId, issueId, name);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeWorkIssueLabelAction(
  boardId: string,
  issueId: string,
  labelId: string,
  labelName: string
): Promise<Ok | Err> {
  try {
    await removeIssueLabel(boardId, issueId, labelId, labelName);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addWorkIssueCommentAction(
  boardId: string,
  issueId: string,
  body: string
): Promise<Ok | Err> {
  try {
    await addIssueComment(boardId, issueId, body);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateWorkIssueCommentAction(
  boardId: string,
  issueId: string,
  commentId: string,
  body: string
): Promise<Ok | Err> {
  try {
    await updateIssueComment(boardId, issueId, commentId, body);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteWorkIssueCommentAction(
  boardId: string,
  issueId: string,
  commentId: string
): Promise<Ok | Err> {
  try {
    await deleteIssueComment(boardId, issueId, commentId);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addWorkIssueRelationAction(
  boardId: string,
  issueId: string,
  otherIssueId: string,
  role: WorkRelationRole
): Promise<Ok | Err> {
  try {
    await addIssueRelation(boardId, issueId, otherIssueId, role);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeWorkIssueRelationAction(
  boardId: string,
  issueId: string,
  relationId: string
): Promise<Ok | Err> {
  try {
    await removeIssueRelation(boardId, issueId, relationId);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadWorkIssueFileAction(
  boardId: string,
  issueId: string,
  formData: FormData
): Promise<(Ok & { id: string }) | Err> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = await uploadIssueFile(boardId, issueId, {
      name: file.name,
      type: file.type,
      size: file.size,
      bytes,
    });
    revalidateBoard(boardId, issueId);
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteWorkIssueFileAction(
  boardId: string,
  issueId: string,
  fileId: string
): Promise<Ok | Err> {
  try {
    await removeIssueFile(boardId, issueId, fileId);
    revalidateBoard(boardId, issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function moveWorkIssueAction(input: {
  boardId: string;
  issueId: string;
  status: WorkIssueStatus;
  issueIds: string[];
}): Promise<Ok | Err> {
  try {
    const index = input.issueIds.indexOf(input.issueId);
    await setWorkIssueStatus(
      input.boardId,
      input.issueId,
      input.status,
      index < 0 ? input.issueIds.length : index
    );
    await reorderWorkIssues(input.boardId, input.status, input.issueIds);
    revalidateBoard(input.boardId, input.issueId);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
