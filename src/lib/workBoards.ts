import "server-only";

import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/appUsers";
import { workBoardHref, workIssueHref } from "@/lib/routes";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import { getCustomersForAppUser } from "@/lib/customerAppUsers";
import { getCustomerIdsForConsultant } from "@/lib/customerConsultants";
import { compareTextSv } from "@/lib/sort";
import {
  canSeeWorkBoard,
  canSeeWorkCustomer,
  type WorkActor,
} from "@/lib/workAccess";
import * as q from "@/lib/workBoardsQueries";
import {
  isValidWorkBoardPrefix,
  normalizeWorkBoardPrefix,
  workIssueKey,
  workPersonFromUser,
} from "@/lib/workIssueKey";
import type {
  WorkBoardView,
  WorkComment,
  WorkCustomerView,
  WorkEvent,
  WorkFile,
  WorkIssue,
  WorkLabel,
  WorkPerson,
  WorkSelectorBoard,
  WorkSelectorCustomer,
} from "@/lib/workTypes";
import {
  fetchBoardLabels,
  fetchIssueAssignees,
  fetchIssueComments,
  fetchIssueEvents,
  fetchIssueFiles,
  fetchIssueLabels,
  fetchWorkIssueRelations,
  fetchWorkAssigneesForCustomer,
  fetchWorkBoardMembers,
  fetchWorkPeopleForCustomer,
  fetchWorkIssuesForBoard,
  fetchLoggedHoursByIssueIds,
} from "@/lib/workIssuesQueries";
import type { WorkBoardStatus } from "@/lib/workStatuses";
import {
  emptyWorkIssueRelations,
  groupRelationsForIssues,
} from "@/lib/workIssueRelations";

export type {
  WorkBoardView,
  WorkCustomerView,
  WorkSelectorBoard,
  WorkSelectorCustomer,
} from "@/lib/workTypes";

async function getWorkActor(): Promise<WorkActor | null> {
  const user = await getCurrentAppUser();
  if (!user || !user.appKeys.includes("work")) return null;
  return { id: user.id, role: user.role };
}

async function requireWorkActorOrRedirect(): Promise<WorkActor> {
  const actor = await getWorkActor();
  if (!actor) redirect("/access-denied");
  return actor;
}

async function requireWorkActorOrThrow(): Promise<WorkActor> {
  const actor = await getWorkActor();
  if (!actor) throw new Error("Unauthorized");
  return actor;
}

async function assignedCustomerIdsForActor(
  actor: WorkActor
): Promise<string[]> {
  if (actor.role === "admin") return [];
  return linkedCustomerIdsForActor(actor);
}

/** Customers this person is linked to. Admin is not treated as “all”. */
async function linkedCustomerIdsForActor(
  actor: WorkActor
): Promise<string[]> {
  if (actor.role === "customer") {
    const customers = await getCustomersForAppUser(actor.id);
    return customers.map((customer) => customer.id);
  }
  const ids = new Set<string>();
  for (const customer of await getCustomersForAppUser(actor.id)) {
    ids.add(customer.id);
  }
  const consultant = await getConsultantForCurrentUser();
  if (consultant?.id) {
    for (const id of await getCustomerIdsForConsultant(consultant.id)) {
      ids.add(id);
    }
  }
  return [...ids];
}

async function loadWorkSelectorCustomers(
  actor: WorkActor
): Promise<WorkSelectorCustomer[]> {
  const assignedIds = await assignedCustomerIdsForActor(actor);
  const customers = (
    actor.role === "admin"
      ? await q.fetchActiveCustomers()
      : await q.fetchActiveCustomersByIds(assignedIds)
  ).filter(
    (customer) => actor.role !== "customer" || !customer.is_internal
  );

  const boards = await q.fetchWorkBoardsForCustomerIds(
    customers.map((customer) => customer.id)
  );
  const boardsByCustomer = new Map<string, WorkSelectorBoard[]>();
  for (const board of boards) {
    const customer = customers.find((row) => row.id === board.customer_id);
    if (!customer) continue;
    if (
      !canSeeWorkBoard(actor, {
        customerIsInternal: customer.is_internal,
        memberAppUserIds: board.member_ids,
      })
    ) {
      continue;
    }
    const list = boardsByCustomer.get(board.customer_id) ?? [];
    list.push({ id: board.id, title: board.title, prefix: board.prefix });
    boardsByCustomer.set(board.customer_id, list);
  }

  return customers
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      color: customer.color,
      url: customer.url,
      isInternal: customer.is_internal,
      boards: boardsByCustomer.get(customer.id) ?? [],
    }))
    .sort(
      (a, b) =>
        Number(b.isInternal) - Number(a.isInternal) ||
        compareTextSv(a.name, b.name)
    );
}

export async function listWorkSelectorCustomers(): Promise<
  WorkSelectorCustomer[]
> {
  const actor = await requireWorkActorOrRedirect();
  return loadWorkSelectorCustomers(actor);
}

export async function listWorkNavCustomers(): Promise<WorkSelectorCustomer[]> {
  const actor = await getWorkActor();
  if (!actor) return [];
  const assignedIds = await linkedCustomerIdsForActor(actor);
  const customers = (
    await q.fetchActiveCustomersByIds(assignedIds)
  ).filter((customer) => actor.role !== "customer" || !customer.is_internal);

  const boards = await q.fetchWorkBoardsForCustomerIds(
    customers.map((customer) => customer.id)
  );
  const boardsByCustomer = new Map<string, WorkSelectorBoard[]>();
  for (const board of boards) {
    const customer = customers.find((row) => row.id === board.customer_id);
    if (!customer) continue;
    if (
      !canSeeWorkBoard(actor, {
        customerIsInternal: customer.is_internal,
        memberAppUserIds: board.member_ids,
      })
    ) {
      continue;
    }
    const list = boardsByCustomer.get(board.customer_id) ?? [];
    list.push({ id: board.id, title: board.title, prefix: board.prefix });
    boardsByCustomer.set(board.customer_id, list);
  }

  return customers
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      color: customer.color,
      url: customer.url,
      isInternal: customer.is_internal,
      boards: boardsByCustomer.get(customer.id) ?? [],
    }))
    .sort(
      (a, b) =>
        Number(b.isInternal) - Number(a.isInternal) ||
        compareTextSv(a.name, b.name)
    );
}

export async function getWorkCustomerView(
  customerId: string
): Promise<WorkCustomerView | null> {
  const actor = await requireWorkActorOrRedirect();
  const assignedIds = await assignedCustomerIdsForActor(actor);
  if (!canSeeWorkCustomer(actor, assignedIds, customerId)) return null;
  const customers = await q.fetchActiveCustomersByIds([customerId]);
  const customer = customers[0];
  if (!customer) return null;

  const [boards, archivedBoards] = await Promise.all([
    q.fetchWorkBoardsForCustomerIds([customer.id]),
    q.fetchWorkBoardsForCustomerIds([customer.id], { archived: true }),
  ]);

  function visibleBoards(rows: typeof boards): WorkSelectorBoard[] {
    return rows
      .filter((board) =>
        canSeeWorkBoard(actor, {
          customerIsInternal: customer.is_internal,
          memberAppUserIds: board.member_ids,
        })
      )
      .map((board) => ({
        id: board.id,
        title: board.title,
        prefix: board.prefix,
      }));
  }

  return {
    id: customer.id,
    name: customer.name,
    color: customer.color,
    url: customer.url,
    isInternal: customer.is_internal,
    boards: visibleBoards(boards),
    archivedBoards: visibleBoards(archivedBoards),
  };
}

/** Old /work/{boardId} bookmarks become /work/{customerId}/{boardId}. */
export async function redirectIfLegacyWorkBoardUrl(
  maybeBoardId: string
): Promise<void> {
  const visible = await requireVisibleWorkBoard(maybeBoardId);
  if (!visible) return;
  redirect(workBoardHref(visible.board.customer_id, visible.board.id));
}

/** Old /work/{boardId}/{issueId} bookmarks become the nested issue URL. */
export async function redirectIfLegacyWorkIssueUrl(
  maybeBoardId: string,
  maybeIssueId: string
): Promise<void> {
  const visible = await requireVisibleWorkBoard(maybeBoardId);
  if (!visible) return;
  redirect(
    workIssueHref(
      visible.board.customer_id,
      visible.board.id,
      maybeIssueId
    )
  );
}

export async function requireVisibleWorkBoard(boardId: string) {
  const actor = await requireWorkActorOrThrow();
  const board = await q.fetchWorkBoardById(boardId);
  if (!board) return null;

  const assignedIds = await assignedCustomerIdsForActor(actor);
  if (!canSeeWorkCustomer(actor, assignedIds, board.customer_id)) {
    return null;
  }
  if (
    !canSeeWorkBoard(actor, {
      customerIsInternal: board.customer_is_internal,
      memberAppUserIds: board.member_ids,
    })
  ) {
    return null;
  }
  return { actor, board };
}

export async function getWorkBoardView(
  boardId: string
): Promise<WorkBoardView | null> {
  const user = await getCurrentAppUser();
  if (!user || !user.appKeys.includes("work")) redirect("/access-denied");
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) return null;
  const { board } = visible;
  const [issueRows, peopleRows, memberRows, statuses, boardLabels] =
    await Promise.all([
      fetchWorkIssuesForBoard(board.id),
      fetchWorkAssigneesForCustomer(board.customer_id, board.id),
      fetchWorkBoardMembers(board.id),
      q.fetchWorkBoardStatuses(board.id),
      fetchBoardLabels(board.id),
    ]);
  const statusIds = new Set(statuses.map((status) => status.id));
  const issueIds = issueRows.map((row) => row.id);
  const [
    assigneeRows,
    labelRows,
    commentRows,
    eventRows,
    fileRows,
    relationRows,
    loggedHoursByIssue,
  ] = await Promise.all([
    fetchIssueAssignees(issueIds),
    fetchIssueLabels(issueIds),
    fetchIssueComments(issueIds),
    fetchIssueEvents(issueIds),
    fetchIssueFiles(issueIds),
    fetchWorkIssueRelations(board.id),
    fetchLoggedHoursByIssueIds(issueIds),
  ]);

  const people = peopleRows.map(workPersonFromUser);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const personOrFallback = (
    id: string,
    name: string | null,
    email: string
  ): WorkPerson => peopleById.get(id) ?? workPersonFromUser({ id, name, email });

  const assigneesByIssue = new Map<string, WorkPerson[]>();
  for (const row of assigneeRows) {
    const list = assigneesByIssue.get(row.issue_id) ?? [];
    list.push(workPersonFromUser(row));
    assigneesByIssue.set(row.issue_id, list);
  }
  const labelsByIssue = new Map<string, WorkLabel[]>();
  for (const row of labelRows) {
    const list = labelsByIssue.get(row.issue_id) ?? [];
    list.push({ id: row.id, name: row.name });
    labelsByIssue.set(row.issue_id, list);
  }
  const commentsByIssue = new Map<string, WorkComment[]>();
  for (const row of commentRows) {
    const list = commentsByIssue.get(row.issue_id) ?? [];
    list.push({
      id: row.id,
      body: row.body,
      createdAt: row.created_at.toISOString(),
      author: workPersonFromUser({
        id: row.author_id,
        name: row.author_name,
        email: row.author_email,
      }),
    });
    commentsByIssue.set(row.issue_id, list);
  }
  const eventsByIssue = new Map<string, WorkEvent[]>();
  for (const row of eventRows) {
    const list = eventsByIssue.get(row.issue_id) ?? [];
    list.push({
      id: row.id,
      kind: row.kind,
      summary: row.summary,
      createdAt: row.created_at.toISOString(),
      actor: workPersonFromUser({
        id: row.actor_id,
        name: row.actor_name,
        email: row.actor_email,
      }),
    });
    eventsByIssue.set(row.issue_id, list);
  }
  const filesByIssue = new Map<string, WorkFile[]>();
  for (const row of fileRows) {
    const list = filesByIssue.get(row.issue_id) ?? [];
    list.push({
      id: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      createdAt: row.created_at.toISOString(),
    });
    filesByIssue.set(row.issue_id, list);
  }

  const issues: WorkIssue[] = issueRows
    .filter((row) => statusIds.has(row.status))
    .map((row) => ({
      id: row.id,
      number: row.number,
      key: workIssueKey(board.prefix, row.number),
      title: row.title,
      status: row.status,
      sortOrder: row.sort_order,
      description: row.description,
      currentState: row.current_state,
      nextStep: row.next_step,
      owner: row.owner_app_user_id
        ? personOrFallback(
            row.owner_app_user_id,
            row.owner_name,
            row.owner_email ?? ""
          )
        : null,
      reporter: row.created_by_app_user_id
        ? personOrFallback(
            row.created_by_app_user_id,
            row.reporter_name,
            row.reporter_email ?? ""
          )
        : null,
      assignees: assigneesByIssue.get(row.id) ?? [],
      labels: labelsByIssue.get(row.id) ?? [],
      comments: commentsByIssue.get(row.id) ?? [],
      events: eventsByIssue.get(row.id) ?? [],
      files: filesByIssue.get(row.id) ?? [],
      relations: emptyWorkIssueRelations(),
      estimateHours:
        row.estimate_hours == null ? null : Number(row.estimate_hours),
      loggedHours: loggedHoursByIssue.get(row.id) ?? 0,
    }));

  const doneByStatus = new Map(
    statuses.map((status) => [status.id, status.isDone])
  );
  const relationRefs = new Map(
    issues.map((issue) => [
      issue.id,
      {
        id: issue.id,
        key: issue.key,
        title: issue.title,
        status: issue.status,
        isDone: doneByStatus.get(issue.status) ?? false,
      },
    ])
  );
  const relationsByIssue = groupRelationsForIssues(
    issues.map((issue) => issue.id),
    relationRows.map((row) => ({
      id: row.id,
      boardId: row.board_id,
      fromIssueId: row.from_issue_id,
      toIssueId: row.to_issue_id,
      kind: row.kind,
    })),
    relationRefs
  );
  for (const issue of issues) {
    issue.relations = relationsByIssue.get(issue.id) ?? emptyWorkIssueRelations();
  }

  return {
    id: board.id,
    title: board.title,
    prefix: board.prefix,
    customerId: board.customer_id,
    customerName: board.customer_name,
    currentUser: workPersonFromUser({
      id: user.id,
      name: user.name,
      email: user.email,
    }),
    people,
    members: memberRows.map(workPersonFromUser),
    statuses,
    boardLabels,
    issues,
  };
}

export async function listWorkCustomerPeople(
  customerId: string
): Promise<WorkPerson[]> {
  const actor = await requireWorkActorOrThrow();
  const assignedIds = await assignedCustomerIdsForActor(actor);
  if (!canSeeWorkCustomer(actor, assignedIds, customerId)) {
    throw new Error("Unauthorized");
  }
  const rows = await fetchWorkPeopleForCustomer(customerId);
  return rows.map(workPersonFromUser);
}

export async function createWorkBoardStatus(
  boardId: string,
  name: string
): Promise<WorkBoardStatus> {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Board not found");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Status name is required");
  return q.insertWorkBoardStatus({ boardId, name: trimmed });
}

export async function renameWorkBoardStatus(
  boardId: string,
  statusId: string,
  name: string
): Promise<WorkBoardStatus> {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Board not found");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Status name is required");
  return q.renameWorkBoardStatus({ boardId, statusId, name: trimmed });
}

export async function reorderWorkBoardStatuses(
  boardId: string,
  statusIds: string[]
): Promise<void> {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Board not found");
  await q.reorderWorkBoardStatuses(boardId, statusIds);
}

export async function deleteWorkBoardStatus(
  boardId: string,
  statusId: string,
  moveToStatusId: string | null
): Promise<void> {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Board not found");
  await q.deleteWorkBoardStatus({
    boardId,
    statusId,
    moveToStatusId,
    actorAppUserId: visible.actor.id,
  });
}

export async function addWorkBoardMember(
  boardId: string,
  appUserId: string
): Promise<void> {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Board not found");
  const allowed = await fetchWorkPeopleForCustomer(visible.board.customer_id);
  if (!allowed.some((row) => row.id === appUserId)) {
    throw new Error("That person is not linked to this customer");
  }
  await q.insertWorkBoardMember(boardId, appUserId);
}

export async function removeWorkBoardMember(
  boardId: string,
  appUserId: string
): Promise<void> {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Board not found");
  if (visible.board.member_ids.length <= 1) {
    throw new Error("A board needs at least one person");
  }
  await q.deleteWorkBoardMember(boardId, appUserId);
}

export async function renameWorkBoard(
  boardId: string,
  title: string
): Promise<{ title: string; customerId: string }> {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Board not found");
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title is required");
  const nextTitle = await q.renameWorkBoard(boardId, trimmed);
  return { title: nextTitle, customerId: visible.board.customer_id };
}

export async function archiveWorkBoard(boardId: string): Promise<string> {
  const visible = await requireVisibleWorkBoard(boardId);
  if (!visible) throw new Error("Board not found");
  await q.archiveWorkBoard(boardId);
  return visible.board.customer_id;
}

export async function restoreWorkBoard(boardId: string): Promise<string> {
  const actor = await requireWorkActorOrThrow();
  const board = await q.fetchArchivedWorkBoardById(boardId);
  if (!board) throw new Error("Board not found");
  const assignedIds = await assignedCustomerIdsForActor(actor);
  if (!canSeeWorkCustomer(actor, assignedIds, board.customer_id)) {
    throw new Error("Board not found");
  }
  if (
    !canSeeWorkBoard(actor, {
      customerIsInternal: board.customer_is_internal,
      memberAppUserIds: board.member_ids,
    })
  ) {
    throw new Error("Board not found");
  }
  await q.restoreWorkBoard(boardId);
  return board.customer_id;
}

export async function createWorkBoard(
  customerId: string,
  title: string,
  prefixInput: string,
  memberAppUserIds?: string[]
): Promise<string> {
  const actor = await requireWorkActorOrThrow();
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Title is required");
  }
  const prefix = normalizeWorkBoardPrefix(prefixInput);
  if (!isValidWorkBoardPrefix(prefix)) {
    throw new Error("Prefix must be 2–8 letters or numbers, starting with a letter");
  }

  const assignedIds = await assignedCustomerIdsForActor(actor);
  if (!canSeeWorkCustomer(actor, assignedIds, customerId)) {
    throw new Error("Unauthorized");
  }

  const customers =
    actor.role === "admin"
      ? await q.fetchActiveCustomers()
      : await q.fetchActiveCustomersByIds(assignedIds);
  const customer = customers.find((row) => row.id === customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  const customerPeople = await fetchWorkPeopleForCustomer(customerId);
  const customerPeopleIds = new Set(customerPeople.map((row) => row.id));
  const requested = (memberAppUserIds ?? customerPeople.map((row) => row.id))
    .filter((id) => customerPeopleIds.has(id) || id === actor.id);

  try {
    return await q.insertWorkBoard({
      customerId,
      title: trimmed,
      prefix,
      createdByAppUserId: actor.id,
      memberAppUserIds: requested,
    });
  } catch (error) {
    const maybePg = error as { code?: string; constraint?: string };
    if (maybePg.code === "23505" && maybePg.constraint === "work_boards_customer_prefix_idx") {
      throw new Error("That prefix is already used on another board for this customer");
    }
    throw error;
  }
}
