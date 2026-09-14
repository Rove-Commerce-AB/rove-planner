"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { GripVertical, MoreHorizontal, Plus, Search } from "lucide-react";
import {
  Button,
  ConfirmModal,
  Dialog,
  IconButton,
  Input,
  Select,
  SideDrawer,
} from "@/components/ui";
import { SetWorkTrail } from "@/components/WorkTrailContext";
import { workBoardHref, workCustomerHref, workIssueHref } from "@/lib/routes";
import type { WorkIssue, WorkBoardView } from "@/lib/workTypes";
import type { WorkBoardStatus, WorkIssueStatus } from "@/lib/workStatuses";
import {
  addWorkBoardMemberAction,
  archiveWorkBoardAction,
  createWorkBoardStatusAction,
  createWorkIssueAction,
  deleteWorkBoardStatusAction,
  moveWorkIssueAction,
  renameWorkBoardAction,
  renameWorkBoardStatusAction,
  removeWorkBoardMemberAction,
  reorderWorkBoardStatusesAction,
} from "../../actions";
import { WorkBoardMembers } from "./WorkBoardMembers";
import { WorkCardPeople, WorkIssueDrawer } from "./WorkIssueDrawer";
import type { WorkPerson } from "@/lib/workTypes";

type Props = {
  board: WorkBoardView;
};

const renameFieldClass =
  "min-w-0 -mx-1 rounded-md bg-bg-default px-1 text-text-primary outline-none focus:ring-2 focus:ring-inset focus:ring-brand-signal/20";

function issuesInStatus(issues: WorkIssue[], status: WorkIssueStatus) {
  return issues
    .filter((issue) => issue.status === status)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number);
}

function computeMove(
  issues: WorkIssue[],
  issueId: string,
  status: WorkIssueStatus,
  beforeIssueId: string | null,
  visibleIds: Set<string>
): { issues: WorkIssue[]; orderedIds: string[] } | null {
  const moving = issues.find((issue) => issue.id === issueId);
  if (!moving) return null;
  const rest = issues
    .filter((issue) => issue.id !== issueId)
    .map((issue) => ({ ...issue }));
  const column = issuesInStatus(rest, status).filter((issue) =>
    visibleIds.has(issue.id)
  );
  const insertAt = beforeIssueId
    ? Math.max(
        0,
        column.findIndex((issue) => issue.id === beforeIssueId)
      )
    : column.length;
  const safeIndex = insertAt < 0 ? column.length : insertAt;
  const moved = { ...moving, status, sortOrder: safeIndex };
  const orderedIds = [
    ...column.slice(0, safeIndex),
    moved,
    ...column.slice(safeIndex),
  ].map((issue) => issue.id);
  if (moving.status === status) {
    const previousIds = issuesInStatus(issues, status)
      .filter((issue) => visibleIds.has(issue.id))
      .map((issue) => issue.id);
    if (
      previousIds.length === orderedIds.length &&
      previousIds.every((id, index) => id === orderedIds[index])
    ) {
      return null;
    }
  }
  return {
    orderedIds,
    issues: [...rest, moved].map((issue) => {
      const index = orderedIds.indexOf(issue.id);
      if (issue.id === issueId) return { ...moved, sortOrder: safeIndex };
      if (index >= 0) return { ...issue, status, sortOrder: index };
      return issue;
    }),
  };
}

function mergeIssuesFromServer(
  local: WorkIssue[],
  server: WorkIssue[]
): WorkIssue[] {
  const localById = new Map(local.map((issue) => [issue.id, issue]));
  return server.map((remote) => {
    const current = localById.get(remote.id);
    if (!current) return remote;
    if (
      current.status !== remote.status ||
      current.sortOrder !== remote.sortOrder
    ) {
      return {
        ...remote,
        status: current.status,
        sortOrder: current.sortOrder,
      };
    }
    return remote;
  });
}

function createTiltedDragImage(event: DragEvent<HTMLElement>): HTMLElement {
  const source = event.currentTarget;
  const rect = source.getBoundingClientRect();
  const pad = 28;
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.top = "0";
  wrap.style.left = "-4000px";
  wrap.style.padding = `${pad}px`;
  wrap.style.pointerEvents = "none";

  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.style.width = `${rect.width}px`;
  ghost.style.margin = "0";
  ghost.style.boxSizing = "border-box";
  ghost.style.transformOrigin = `${offsetX}px ${offsetY}px`;
  ghost.style.transform = "rotate(3deg)";
  ghost.style.boxShadow = "var(--shadow-lg)";
  wrap.appendChild(ghost);
  document.body.appendChild(wrap);
  event.dataTransfer.setDragImage(wrap, offsetX + pad, offsetY + pad);
  return wrap;
}

export function WorkBoardPageClient({ board }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const selectedIssueId = pathname.split("/").filter(Boolean)[3] ?? null;
  const [pending, startTransition] = useTransition();
  const [issues, setIssues] = useState(board.issues);
  const [search, setSearch] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState<WorkIssueStatus | null>(
    null
  );
  const [issueDropBefore, setIssueDropBefore] = useState<{
    status: WorkIssueStatus;
    beforeIssueId: string | null;
  } | null>(null);
  const dragIssueIdRef = useRef<string | null>(null);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const dragSourceRef = useRef<HTMLElement | null>(null);
  const dragSourceStatusRef = useRef<WorkIssueStatus | null>(null);
  const skipCardClickRef = useRef(false);
  const dropTargetRef = useRef<{
    issueId: string;
    status: WorkIssueStatus;
    beforeIssueId: string | null;
  } | null>(null);
  const issuesRef = useRef(board.issues);
  const [addingStatus, setAddingStatus] = useState<WorkIssueStatus | null>(
    null
  );
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState(board.members);
  const [statuses, setStatuses] = useState(board.statuses);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnDraft, setColumnDraft] = useState("");
  const [deletingStatus, setDeletingStatus] = useState<WorkBoardStatus | null>(
    null
  );
  const [moveToStatusId, setMoveToStatusId] = useState("");
  const [statusMenu, setStatusMenu] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const [boardMenu, setBoardMenu] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [boardTitle, setBoardTitle] = useState(board.title);
  const [renamingBoard, setRenamingBoard] = useState(false);
  const [boardRenameDraft, setBoardRenameDraft] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [renamingStatusId, setRenamingStatusId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [draggingStatusId, setDraggingStatusId] = useState<string | null>(null);
  const [statusInsertBeforeId, setStatusInsertBeforeId] = useState<
    string | null | undefined
  >(undefined);
  const statusesRef = useRef(board.statuses);
  const draggingStatusIdRef = useRef<string | null>(null);
  const statusInsertBeforeRef = useRef<string | null>(null);

  useEffect(() => {
    setIssues((current) => {
      const next = mergeIssuesFromServer(current, board.issues);
      issuesRef.current = next;
      return next;
    });
  }, [board.issues]);

  useEffect(() => {
    setMembers(board.members);
  }, [board.members]);

  useEffect(() => {
    statusesRef.current = board.statuses;
    setStatuses(board.statuses);
  }, [board.statuses]);

  useEffect(() => {
    setBoardTitle(board.title);
  }, [board.title]);

  useEffect(() => {
    if (!statusMenu) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-status-menu]")) {
        return;
      }
      setStatusMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [statusMenu]);

  useEffect(() => {
    if (!boardMenu) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-board-menu]")) {
        return;
      }
      setBoardMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [boardMenu]);

  const selected = issues.find((issue) => issue.id === selectedIssueId) ?? null;
  const deletingIssueCount = deletingStatus
    ? issues.filter((issue) => issue.status === deletingStatus.id).length
    : 0;
  const query = search.trim().toLowerCase();

  const visibleIds = useMemo(() => {
    if (!query) return new Set(issues.map((issue) => issue.id));
    return new Set(
      issues
        .filter(
          (issue) =>
            issue.title.toLowerCase().includes(query) ||
            issue.key.toLowerCase().includes(query)
        )
        .map((issue) => issue.id)
    );
  }, [issues, query]);

  function openIssue(issueId: string) {
    router.push(workIssueHref(board.customerId, board.id, issueId), {
      scroll: false,
    });
  }

  function closeIssue() {
    router.push(workBoardHref(board.customerId, board.id), { scroll: false });
  }

  function moveIssue(
    issueId: string,
    status: WorkIssueStatus,
    beforeIssueId: string | null
  ) {
    const result = computeMove(
      issuesRef.current,
      issueId,
      status,
      beforeIssueId,
      visibleIds
    );
    if (!result) return;
    issuesRef.current = result.issues;
    setIssues(result.issues);
    setError(null);
    void moveWorkIssueAction({
      boardId: board.id,
      issueId,
      status,
      issueIds: result.orderedIds,
    }).then((actionResult) => {
      if (actionResult.ok) return;
      issuesRef.current = board.issues;
      setError(actionResult.error);
      setIssues(board.issues);
    });
  }

  function moveStatus(statusId: string, beforeStatusId: string | null) {
    if (statusId === beforeStatusId) return;
    const list = statusesRef.current;
    const current = list.find((status) => status.id === statusId);
    if (!current) return;
    const rest = list.filter((status) => status.id !== statusId);
    const insertAt = beforeStatusId
      ? rest.findIndex((status) => status.id === beforeStatusId)
      : rest.length;
    const safeIndex = insertAt < 0 ? rest.length : insertAt;
    const next = [
      ...rest.slice(0, safeIndex),
      current,
      ...rest.slice(safeIndex),
    ].map((status, index) => ({ ...status, sortOrder: index }));
    if (next.every((status, index) => status.id === list[index]?.id)) return;
    statusesRef.current = next;
    setStatuses(next);
    void reorderWorkBoardStatusesAction(
      board.id,
      next.map((status) => status.id)
    ).then((result) => {
      if (result.ok) return;
      statusesRef.current = board.statuses;
      setStatuses(board.statuses);
      setError(result.error);
    });
  }

  function clearStatusDrag() {
    draggingStatusIdRef.current = null;
    statusInsertBeforeRef.current = null;
    setDraggingStatusId(null);
    setStatusInsertBeforeId(undefined);
  }

  function setStatusInsertHint(beforeId: string | null) {
    statusInsertBeforeRef.current = beforeId;
    setStatusInsertBeforeId((current) =>
      current === beforeId ? current : beforeId
    );
  }

  function statusInsertBeforeFromPoint(
    columnId: string,
    clientX: number,
    columnEl: HTMLElement
  ) {
    const rect = columnEl.getBoundingClientRect();
    const after = clientX > rect.left + rect.width / 2;
    const ids = statusesRef.current.map((status) => status.id);
    const index = ids.indexOf(columnId);
    if (!after) return columnId;
    return ids[index + 1] ?? null;
  }

  function handleStatusDragOver(
    event: DragEvent,
    columnId: string | null
  ) {
    if (!draggingStatusIdRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    if (columnId == null) {
      setStatusInsertHint(null);
      return true;
    }
    const columnEl =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.closest("section")
        : null;
    if (!(columnEl instanceof HTMLElement)) {
      setStatusInsertHint(columnId);
      return true;
    }
    setStatusInsertHint(
      statusInsertBeforeFromPoint(columnId, event.clientX, columnEl)
    );
    return true;
  }

  function handleStatusDrop(event: DragEvent) {
    const dragged =
      event.dataTransfer.getData("application/x-work-status") ||
      draggingStatusIdRef.current;
    if (
      !dragged ||
      !statusesRef.current.some((status) => status.id === dragged)
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    const beforeId = statusInsertBeforeRef.current;
    clearStatusDrag();
    moveStatus(dragged, beforeId);
    return true;
  }

  async function submitNewColumn() {
    const trimmed = columnDraft.trim();
    if (!trimmed) {
      setAddingColumn(false);
      return;
    }
    const result = await createWorkBoardStatusAction(board.id, trimmed);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatuses((current) => {
      const next = [...current, result.status];
      statusesRef.current = next;
      return next;
    });
    setColumnDraft("");
    setAddingColumn(false);
  }

  function openDeleteStatus(column: WorkBoardStatus) {
    const index = statuses.findIndex((status) => status.id === column.id);
    const fallback = statuses[index - 1] ?? statuses[index + 1];
    setStatusMenu(null);
    setDeletingStatus(column);
    setMoveToStatusId(fallback?.id ?? "");
  }

  function startRenameStatus(column: WorkBoardStatus) {
    setStatusMenu(null);
    setRenamingStatusId(column.id);
    setRenameDraft(column.name);
  }

  function startRenameBoard() {
    setBoardMenu(null);
    setRenamingBoard(true);
    setBoardRenameDraft(boardTitle);
  }

  async function submitRenameBoard() {
    if (!renamingBoard) return;
    const trimmed = boardRenameDraft.trim();
    setRenamingBoard(false);
    if (!trimmed || trimmed === boardTitle) return;
    const previous = boardTitle;
    setBoardTitle(trimmed);
    const result = await renameWorkBoardAction(board.id, trimmed);
    if (result.ok) {
      setBoardTitle(result.title);
      return;
    }
    setBoardTitle(previous);
    setError(result.error);
  }

  async function confirmArchiveBoard() {
    setError(null);
    const result = await archiveWorkBoardAction(board.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(workCustomerHref(result.customerId));
  }

  async function submitRenameStatus() {
    const statusId = renamingStatusId;
    if (!statusId) return;
    const trimmed = renameDraft.trim();
    setRenamingStatusId(null);
    if (!trimmed) return;
    const current = statusesRef.current.find((status) => status.id === statusId);
    if (!current || current.name === trimmed) return;
    const previous = current.name;
    setStatuses((list) => {
      const next = list.map((status) =>
        status.id === statusId ? { ...status, name: trimmed } : status
      );
      statusesRef.current = next;
      return next;
    });
    const result = await renameWorkBoardStatusAction(
      board.id,
      statusId,
      trimmed
    );
    if (result.ok) return;
    setStatuses((list) => {
      const next = list.map((status) =>
        status.id === statusId ? { ...status, name: previous } : status
      );
      statusesRef.current = next;
      return next;
    });
    setError(result.error);
  }

  async function submitDeleteStatus() {
    if (!deletingStatus) return;
    const fromId = deletingStatus.id;
    const issueCount = issues.filter((issue) => issue.status === fromId).length;
    const destination = issueCount > 0 ? moveToStatusId : null;
    if (issueCount > 0 && !destination) {
      setError("Choose a status to move issues to");
      return;
    }
    const result = await deleteWorkBoardStatusAction(
      board.id,
      fromId,
      destination
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const nextStatuses = statusesRef.current
      .filter((status) => status.id !== fromId)
      .map((status, index) => ({ ...status, sortOrder: index }));
    statusesRef.current = nextStatuses;
    setStatuses(nextStatuses);
    if (destination) {
      setIssues((current) => {
        const destMax = current
          .filter((issue) => issue.status === destination)
          .reduce((max, issue) => Math.max(max, issue.sortOrder), -1);
        let nextOrder = destMax + 1;
        const next = current.map((issue) => {
          if (issue.status !== fromId) return issue;
          const moved = { ...issue, status: destination, sortOrder: nextOrder };
          nextOrder += 1;
          return moved;
        });
        issuesRef.current = next;
        return next;
      });
    }
    setDeletingStatus(null);
    setError(null);
  }

  function draggedIssueId(event: DragEvent) {
    const data =
      event.dataTransfer.getData("text/plain") || dragIssueIdRef.current;
    if (!data || data.startsWith("status:")) return null;
    return data;
  }

  function dropOnColumn(
    event: DragEvent,
    status: WorkIssueStatus,
    beforeIssueId: string | null
  ) {
    event.preventDefault();
    event.stopPropagation();
    const issueId = draggedIssueId(event);
    if (!issueId || issueId === beforeIssueId) {
      dropTargetRef.current = null;
      return;
    }
    dropTargetRef.current = { issueId, status, beforeIssueId };
  }

  function previewIssueDrop(
    event: DragEvent,
    status: WorkIssueStatus,
    beforeIssueId: string | null
  ) {
    if (draggingStatusIdRef.current || !dragIssueIdRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const issueId = dragIssueIdRef.current;
    const nextTarget =
      issueId === beforeIssueId
        ? null
        : { issueId, status, beforeIssueId };
    dropTargetRef.current = nextTarget;
    const showLine =
      nextTarget != null &&
      computeMove(
        issuesRef.current,
        issueId,
        status,
        beforeIssueId,
        visibleIds
      ) != null;
    setIssueDropBefore((current) => {
      if (!showLine) return current == null ? current : null;
      if (
        current?.status === status &&
        current.beforeIssueId === beforeIssueId
      ) {
        return current;
      }
      return { status, beforeIssueId };
    });
    if (status !== dragSourceStatusRef.current && dragOverStatus !== status) {
      setDragOverStatus(status);
    }
    return true;
  }

  function insertBeforeFromPoint(listEl: HTMLElement | null, clientY: number) {
    if (!listEl) return null;
    const cards = listEl.querySelectorAll<HTMLElement>(":scope > [data-issue-id]");
    for (const card of cards) {
      const id = card.dataset.issueId;
      if (!id) continue;
      const rect = card.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return id;
    }
    return null;
  }

  function issueListFromEvent(event: DragEvent): HTMLElement | null {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return null;
    if (target.matches("[data-issue-list]")) return target;
    const list =
      target.closest("[data-issue-list]") ??
      target.querySelector("[data-issue-list]");
    return list instanceof HTMLElement ? list : null;
  }

  function finishDrag() {
    const target = dropTargetRef.current;
    const source = dragSourceRef.current;
    dropTargetRef.current = null;
    dragIssueIdRef.current = null;
    dragSourceRef.current = null;
    dragSourceStatusRef.current = null;
    dragGhostRef.current?.remove();
    dragGhostRef.current = null;
    setDragOverStatus(null);
    setIssueDropBefore(null);
    if (source) source.style.opacity = "";
    if (!target) return;
    moveIssue(target.issueId, target.status, target.beforeIssueId);
  }

  async function submitNewIssue(status: WorkIssueStatus, title: string) {
    const trimmed = title.trim();
    if (!trimmed || !status) return;
    setError(null);
    const result = await createWorkIssueAction({
      boardId: board.id,
      title: trimmed,
      status,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraftTitle("");
    setAddingStatus(null);
    router.refresh();
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <SetWorkTrail
        customerName={board.customerName}
        boardTitle={boardTitle}
        issueKey={selected?.key}
      />
      <header className="mb-6 shrink-0">
        <div className="min-w-0">
          {renamingBoard ? (
            <form
              className="min-w-0"
              onSubmit={(event) => {
                event.preventDefault();
                void submitRenameBoard();
              }}
            >
              <input
                value={boardRenameDraft}
                onChange={(event) => setBoardRenameDraft(event.target.value)}
                onBlur={() => {
                  void submitRenameBoard();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setRenamingBoard(false);
                  }
                }}
                aria-label="Rename board"
                autoFocus
                className={`${renameFieldClass} w-full max-w-xl text-heading-xl`}
              />
            </form>
          ) : (
            <h1 className="min-w-0 text-heading-xl text-text-primary">
              {boardTitle}
            </h1>
          )}
          <p className="mt-1.5 text-[13px] text-text-secondary">
            <Link
              href={workCustomerHref(board.customerId)}
              className="hover:text-text-primary"
            >
              {board.customerName}
            </Link>
          </p>
        </div>
      </header>

      <div className="mb-4 flex shrink-0 items-center gap-3">
        <WorkBoardMembers
          members={members}
          people={board.people}
          onAdd={(person) => {
            setMembers((current) =>
              current.some((row) => row.id === person.id)
                ? current
                : [...current, person]
            );
            void addWorkBoardMemberAction(board.id, person.id).then(
              (result) => {
                if (result.ok) return;
                setMembers(board.members);
                setError(result.error);
              }
            );
          }}
          onRemove={(person: WorkPerson) => {
            if (members.length <= 1) {
              setError("A board needs at least one person");
              return;
            }
            setMembers((current) =>
              current.filter((row) => row.id !== person.id)
            );
            void removeWorkBoardMemberAction(board.id, person.id).then(
              (result) => {
                if (result.ok) {
                  if (person.id === board.currentUser.id) {
                    router.push(workCustomerHref(board.customerId));
                  }
                  return;
                }
                setMembers(board.members);
                setError(result.error);
              }
            );
          }}
        />
        <div className="relative w-44 shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            type="search"
            size="compact"
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search issues"
            className="h-7 py-0 pl-8 text-[13px]"
          />
        </div>
        <IconButton
          data-board-menu
          aria-label="Board options"
          aria-expanded={boardMenu != null}
          aria-haspopup="menu"
          title="Board options"
          className="ml-auto"
          onClick={(event) => {
            if (boardMenu) {
              setBoardMenu(null);
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            const width = 160;
            setBoardMenu({
              top: rect.bottom + 4,
              left: Math.min(
                rect.right - width,
                window.innerWidth - width - 8
              ),
            });
          }}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>

      {error ? (
        <p className="mb-3 shrink-0 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden">
        {statuses.map((column, columnIndex) => {
          const status = column.id;
          const columnIssues = issuesInStatus(issues, status).filter((issue) =>
            visibleIds.has(issue.id)
          );
          const isDone = column.isDone;
          const isDragOver = dragOverStatus === status && !draggingStatusId;
          const isLastColumn = columnIndex === statuses.length - 1;
          const showInsertBefore =
            draggingStatusId != null &&
            statusInsertBeforeId === status &&
            draggingStatusId !== status;
          const showInsertAfter =
            draggingStatusId != null &&
            statusInsertBeforeId === null &&
            isLastColumn;
          return (
            <section
              key={status}
              className={`relative flex h-full min-h-0 w-72 shrink-0 flex-col rounded-xl transition-colors ${
                draggingStatusId === status ? "opacity-40" : ""
              } ${
                isDragOver
                  ? "bg-brand-signal/10 ring-2 ring-inset ring-brand-signal"
                  : "bg-surface-subtle"
              }`}
              onDragOver={(event) => {
                if (handleStatusDragOver(event, status)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (status === dragSourceStatusRef.current) {
                  if (dragOverStatus != null) setDragOverStatus(null);
                  return;
                }
                if (dragOverStatus !== status) setDragOverStatus(status);
              }}
              onDragLeave={(event) => {
                const next = event.relatedTarget;
                if (next instanceof Node && event.currentTarget.contains(next)) {
                  return;
                }
                if (dragOverStatus === status) setDragOverStatus(null);
              }}
              onDrop={(event) => {
                if (handleStatusDrop(event)) return;
                dropOnColumn(event, status, null);
              }}
            >
              {showInsertBefore ? (
                <span
                  className="pointer-events-none absolute -left-2 top-2 bottom-2 w-1 rounded-full bg-brand-signal"
                  aria-hidden
                />
              ) : null}
              {showInsertAfter ? (
                <span
                  className="pointer-events-none absolute -right-2 top-2 bottom-2 w-1 rounded-full bg-brand-signal"
                  aria-hidden
                />
              ) : null}
              <header
                className={`flex items-center justify-between rounded-t-xl px-3 py-2 text-label-l ${
                  isDone
                    ? "bg-text-primary text-bg-default"
                    : isDragOver
                      ? "text-brand-signal"
                      : "text-text-primary"
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    draggable
                    tabIndex={0}
                    aria-label={`Reorder ${column.name}`}
                    title="Move status"
                    className="inline-flex shrink-0 select-none !cursor-move items-center text-current/45 hover:text-current"
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.setData(
                        "application/x-work-status",
                        status
                      );
                      event.dataTransfer.setData("text/plain", `status:${status}`);
                      event.dataTransfer.effectAllowed = "move";
                      draggingStatusIdRef.current = status;
                      setDraggingStatusId(status);
                      const columnEl = event.currentTarget.closest("section");
                      if (columnEl instanceof HTMLElement) {
                        event.dataTransfer.setDragImage(columnEl, 24, 16);
                      }
                    }}
                    onDragEnd={() => {
                      window.setTimeout(() => {
                        clearStatusDrag();
                      }, 0);
                    }}
                  >
                    <GripVertical className="pointer-events-none h-4 w-4" aria-hidden />
                  </span>
                  {renamingStatusId === status ? (
                    <form
                      className="min-w-0 flex-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitRenameStatus();
                      }}
                    >
                      <input
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onBlur={() => {
                          void submitRenameStatus();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setRenamingStatusId(null);
                          }
                        }}
                        aria-label={`Rename ${column.name}`}
                        autoFocus
                        className={`${renameFieldClass} w-full text-label-l`}
                      />
                    </form>
                  ) : (
                    <span className="truncate">{column.name}</span>
                  )}
                </span>
                <button
                  type="button"
                  data-status-menu
                  aria-label={`Status options for ${column.name}`}
                  aria-expanded={statusMenu?.id === status}
                  aria-haspopup="menu"
                  title="Status options"
                  className="inline-flex shrink-0 items-center rounded-sm p-0.5 text-current/45 hover:bg-current/10 hover:text-current"
                  onClick={(event) => {
                    if (statusMenu?.id === status) {
                      setStatusMenu(null);
                      return;
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    const width = 128;
                    setStatusMenu({
                      id: status,
                      top: rect.bottom + 4,
                      left: Math.min(
                        rect.right - width,
                        window.innerWidth - width - 8
                      ),
                    });
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </header>

              <div
                className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                onDragOver={(event) => {
                  if (handleStatusDragOver(event, status)) return;
                  previewIssueDrop(
                    event,
                    status,
                    insertBeforeFromPoint(
                      issueListFromEvent(event),
                      event.clientY
                    )
                  );
                }}
                onDrop={(event) => {
                  if (handleStatusDrop(event)) return;
                  dropOnColumn(
                    event,
                    status,
                    insertBeforeFromPoint(
                      issueListFromEvent(event),
                      event.clientY
                    )
                  );
                }}
              >
              <ul data-issue-list className="relative flex flex-col gap-2 px-2 pt-2 pb-6">
                {columnIssues.map((issue) => {
                  const showInsertBefore =
                    issueDropBefore?.status === status &&
                    issueDropBefore.beforeIssueId === issue.id &&
                    dragIssueIdRef.current !== issue.id;
                  return (
                  <li
                    key={issue.id}
                    data-issue-id={issue.id}
                    className="relative"
                    onDragOver={(event) => {
                      if (handleStatusDragOver(event, status)) return;
                      previewIssueDrop(
                        event,
                        status,
                        insertBeforeFromPoint(
                          issueListFromEvent(event),
                          event.clientY
                        )
                      );
                    }}
                    onDrop={(event) => {
                      if (handleStatusDrop(event)) return;
                      dropOnColumn(
                        event,
                        status,
                        insertBeforeFromPoint(
                          issueListFromEvent(event),
                          event.clientY
                        )
                      );
                    }}
                  >
                    {showInsertBefore ? (
                      <span
                        className="pointer-events-none absolute -top-1.5 right-0 left-0 h-0.5 rounded-full bg-brand-signal"
                        aria-hidden
                      />
                    ) : null}
                    <article
                      draggable
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${issue.key}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openIssue(issue.id);
                        }
                      }}
                      onClick={() => {
                        if (skipCardClickRef.current) return;
                        openIssue(issue.id);
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", issue.id);
                        event.dataTransfer.effectAllowed = "move";
                        dragGhostRef.current?.remove();
                        dragGhostRef.current = createTiltedDragImage(event);
                        dragIssueIdRef.current = issue.id;
                        dragSourceStatusRef.current = status;
                        const source = event.currentTarget;
                        dragSourceRef.current = source;
                        dropTargetRef.current = null;
                        skipCardClickRef.current = true;
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            if (dragSourceRef.current === source) {
                              source.style.opacity = "0";
                            }
                          });
                        });
                      }}
                      onDragEnd={() => {
                        finishDrag();
                        window.setTimeout(() => {
                          skipCardClickRef.current = false;
                        }, 0);
                      }}
                      className={`cursor-grab select-none rounded-lg border bg-bg-default p-3 shadow-sm active:cursor-grabbing ${
                        selectedIssueId === issue.id
                          ? "border-accent-primary"
                          : "border-border-subtle hover:border-border-default"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 text-left">
                        <div className="min-w-0">
                          <span className="text-label-s text-text-tertiary">
                            {issue.key}
                          </span>
                          <p className="mt-1 text-body-m text-text-primary">
                            {issue.title}
                          </p>
                        </div>
                        <WorkCardPeople
                          owner={issue.owner}
                          assignees={issue.assignees}
                        />
                      </div>
                    </article>
                  </li>
                  );
                })}
                {issueDropBefore?.status === status &&
                issueDropBefore.beforeIssueId == null ? (
                  <span
                    className="pointer-events-none absolute bottom-3 left-2 right-2 h-0.5 rounded-full bg-brand-signal"
                    aria-hidden
                  />
                ) : null}
              </ul>

              {addingStatus === status ? (
                <form
                  className="px-2 pb-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startTransition(() => void submitNewIssue(status, draftTitle));
                  }}
                >
                  <Input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Issue title"
                    aria-label="New issue title"
                    autoFocus
                    onBlur={() => {
                      if (!draftTitle.trim()) setAddingStatus(null);
                    }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className="mx-2 mb-3 flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-body-m text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                  onClick={() => {
                    setAddingStatus(status);
                    setDraftTitle("");
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add issue
                </button>
              )}
              </div>
            </section>
          );
        })}
        <div
          className="flex w-72 shrink-0 flex-col self-start"
          onDragOver={(event) => {
            handleStatusDragOver(event, null);
          }}
          onDrop={(event) => {
            handleStatusDrop(event);
          }}
        >
          {addingColumn ? (
            <form
              className="rounded-xl bg-surface-subtle px-3 py-2"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(() => void submitNewColumn());
              }}
            >
              <Input
                value={columnDraft}
                onChange={(event) => setColumnDraft(event.target.value)}
                placeholder="Status name"
                aria-label="New status name"
                autoFocus
                onBlur={() => {
                  if (!columnDraft.trim()) setAddingColumn(false);
                }}
              />
            </form>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-left text-body-m text-text-secondary hover:bg-bg-muted hover:text-text-primary"
              onClick={() => {
                setAddingColumn(true);
                setColumnDraft("");
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add status
            </button>
          )}
        </div>
      </div>

      {boardMenu
        ? createPortal(
            <div
              data-board-menu
              role="menu"
              className="fixed z-50 min-w-40 rounded-lg border border-border-subtle bg-bg-default py-1 shadow-lg"
              style={{ top: boardMenu.top, left: boardMenu.left }}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
                onClick={() => startRenameBoard()}
              >
                Rename board
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-1.5 text-left text-body-m text-danger hover:bg-danger/10"
                onClick={() => {
                  setBoardMenu(null);
                  setArchiveOpen(true);
                }}
              >
                Archive
              </button>
            </div>,
            document.body
          )
        : null}

      <ConfirmModal
        isOpen={archiveOpen}
        title="Archive board"
        message="This board will be hidden from Rove Work. Issues are kept."
        confirmLabel="Archive"
        variant="danger"
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => confirmArchiveBoard()}
      />

      {statusMenu
        ? createPortal(
            <div
              data-status-menu
              role="menu"
              className="fixed z-50 min-w-32 rounded-lg border border-border-subtle bg-bg-default py-1 shadow-lg"
              style={{ top: statusMenu.top, left: statusMenu.left }}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
                onClick={() => {
                  const column = statuses.find(
                    (status) => status.id === statusMenu.id
                  );
                  if (column) startRenameStatus(column);
                }}
              >
                Rename
              </button>
              {statuses.length > 1 ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full px-3 py-1.5 text-left text-body-m text-danger hover:bg-danger/10"
                  onClick={() => {
                    const column = statuses.find(
                      (status) => status.id === statusMenu.id
                    );
                    if (column) openDeleteStatus(column);
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}

      <Dialog
        open={deletingStatus != null}
        onOpenChange={(open) => {
          if (!open) setDeletingStatus(null);
        }}
        title={
          deletingStatus ? `Delete ${deletingStatus.name}` : "Delete status"
        }
        contentClassName="max-w-md"
      >
        <form
          className="modal-form-discreet mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => void submitDeleteStatus());
          }}
        >
          {deletingStatus && deletingIssueCount > 0 ? (
              <>
                <p className="text-sm text-text-secondary">
                  Move {deletingIssueCount}{" "}
                  {deletingIssueCount === 1 ? "issue" : "issues"} to another
                  status.
                </p>
                <Select
                  label="Move issues to"
                  variant="modal"
                  value={moveToStatusId}
                  onValueChange={setMoveToStatusId}
                  options={statuses
                    .filter((status) => status.id !== deletingStatus.id)
                    .map((status) => ({
                      value: status.id,
                      label: status.name,
                    }))}
                />
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                This status has no issues.
              </p>
            )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeletingStatus(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={
                pending || (deletingIssueCount > 0 && !moveToStatusId)
              }
            >
              Delete status
            </Button>
          </div>
        </form>
      </Dialog>

      <SideDrawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) closeIssue();
        }}
        title={selected?.key ?? "Issue"}
        bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
      >
        {selected ? (
          <WorkIssueDrawer
            board={board}
            issue={selected}
            onStatus={(status) => {
              moveIssue(selected.id, status, null);
            }}
            onChanged={() => {
              setError(null);
              router.refresh();
            }}
            onError={(message) => {
              setError(message);
              issuesRef.current = board.issues;
              setIssues(board.issues);
            }}
            onIssuePatch={(patch) => {
              setIssues((current) => {
                const next = current.map((issue) =>
                  issue.id === selected.id ? { ...issue, ...patch } : issue
                );
                issuesRef.current = next;
                return next;
              });
            }}
          />
        ) : null}
      </SideDrawer>
    </div>
  );
}
