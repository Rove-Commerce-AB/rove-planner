"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type TransitionStartFunction,
} from "react";
import { ArrowLeft, Pencil, Share2, Trash2, UserMinus } from "lucide-react";
import { BoardMemberAvatars } from "@/components/taskboard/BoardMemberAvatars";
import { TodoDueDatePicker } from "@/components/taskboard/TodoDueDatePicker";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui";
import { Select, type SelectOption } from "@/components/ui/Select";
import {
  addBoardMemberAction,
  createTodoAction,
  deleteBoardAction,
  removeBoardMemberAction,
  searchBoardInviteUsersAction,
  setTodoAssigneeAction,
  setTodoDueDateAction,
  setTodoDoneAction,
  updateBoardTitleAction,
} from "../actions";
import type { BoardInviteUserRow } from "../actions";

export type TaskboardTodoClient = {
  id: string;
  title: string;
  status: "todo" | "done";
  assigned_to_app_user_id: string | null;
  assignee_label: string | null;
  /** `YYYY-MM-DD` or empty string when unset. */
  due_date: string;
};

function isPastDueDate(iso: string, status: "todo" | "done"): boolean {
  if (!iso || status === "done") return false;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const parts = iso.split("-").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;
  const due = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  return due < t0;
}

function todoAssigneeOptions(
  t: TaskboardTodoClient,
  members: TaskboardMemberClient[]
): SelectOption[] {
  const opts: SelectOption[] = [
    { value: "", label: "Unassigned" },
    ...members.map((m) => ({
      value: m.app_user_id,
      label: (m.name && m.name.trim()) || m.email,
    })),
  ];
  if (
    t.assigned_to_app_user_id &&
    !members.some((m) => m.app_user_id === t.assigned_to_app_user_id)
  ) {
    opts.push({
      value: t.assigned_to_app_user_id,
      label: t.assignee_label || t.assigned_to_app_user_id,
    });
  }
  return opts;
}

function TaskboardTodoListRow({
  t,
  boardId,
  pending,
  members,
  grayedOut,
  startTransition,
  onRefresh,
}: {
  t: TaskboardTodoClient;
  boardId: string;
  pending: boolean;
  members: TaskboardMemberClient[];
  grayedOut: boolean;
  startTransition: TransitionStartFunction;
  onRefresh: () => void;
}) {
  return (
    <li
      className={`flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:gap-4 ${
        grayedOut ? "opacity-80" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-form"
          checked={t.status === "done"}
          disabled={pending}
          onChange={(e) => {
            const done = e.target.checked;
            startTransition(async () => {
              const r = await setTodoDoneAction(boardId, t.id, done);
              if (!r.ok) {
                window.alert(r.error);
                return;
              }
              onRefresh();
            });
          }}
        />
        <span
          className={
            grayedOut ? "text-text-muted" : "text-text-primary"
          }
        >
          {t.title}
        </span>
      </div>
      <div className="w-full shrink-0 sm:w-auto sm:pl-1">
        <TodoDueDatePicker
          value={t.due_date}
          disabled={pending}
          pastDue={isPastDueDate(t.due_date, t.status)}
          ariaLabel="Due date"
          onValueChange={(v) => {
            startTransition(async () => {
              const r = await setTodoDueDateAction(boardId, t.id, v);
              if (!r.ok) {
                window.alert(r.error);
                return;
              }
              onRefresh();
            });
          }}
        />
      </div>
      <div className="w-full shrink-0 sm:w-56 sm:pl-2">
        <Select
          id={`todo-assign-${t.id}`}
          value={t.assigned_to_app_user_id ?? ""}
          onValueChange={(v) => {
            startTransition(async () => {
              const r = await setTodoAssigneeAction(
                boardId,
                t.id,
                v === "" ? null : v
              );
              if (!r.ok) {
                window.alert(r.error);
                return;
              }
              onRefresh();
            });
          }}
          options={todoAssigneeOptions(t, members)}
          placeholder="Assign…"
          size="sm"
          variant="filter"
          disabled={pending}
          triggerClassName="h-8"
          triggerTitle="Choose who is assigned to this todo"
        />
      </div>
    </li>
  );
}

export type TaskboardMemberClient = {
  app_user_id: string;
  email: string;
  name: string | null;
};

type Props = {
  boardId: string;
  initialTitle: string;
  createdByAppUserId: string;
  isCreator: boolean;
  todos: TaskboardTodoClient[];
  members: TaskboardMemberClient[];
};

export function TaskboardDetailPageClient({
  boardId,
  initialTitle,
  createdByAppUserId,
  isCreator,
  todos: initialTodos,
  members: initialMembers,
}: Props) {
  const router = useRouter();
  const newTodoInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [todoError, setTodoError] = useState<string | null>(null);

  const [titleOpen, setTitleOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialTitle);
  const [titleError, setTitleError] = useState<string | null>(null);

  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<BoardInviteUserRow[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);

  const [deleteBoardOpen, setDeleteBoardOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  useEffect(() => {
    setTitleDraft(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    newTodoInputRef.current?.focus();
  }, [boardId]);

  const runSearch = useCallback(
    async (q: string) => {
      if (!isCreator || q.trim().length < 1) {
        setInviteResults([]);
        return;
      }
      setInviteBusy(true);
      try {
        const r = await searchBoardInviteUsersAction(boardId, q);
        if (r.ok) {
          setInviteResults(r.users);
        } else {
          setInviteResults([]);
        }
      } finally {
        setInviteBusy(false);
      }
    },
    [boardId, isCreator]
  );

  useEffect(() => {
    if (!isCreator || !membersOpen) return;
    const t = window.setTimeout(() => {
      void runSearch(inviteQuery);
    }, 320);
    return () => window.clearTimeout(t);
  }, [inviteQuery, isCreator, membersOpen, runSearch]);

  const openTodos = initialTodos.filter((t) => t.status === "todo");
  const doneTodos = initialTodos.filter((t) => t.status === "done");
  const refreshBoard = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="w-full min-w-0 space-y-8">
      <div>
        <Link
          href="/taskboard"
          title="Back to all boards"
          aria-label="Back to all boards"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-text-primary/80 transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All boards
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <PageHeader
              title={initialTitle}
              titleTooltip={initialTitle}
              className="mb-0"
            />
            {initialMembers.length > 0 ? (
              <div className="mt-2">
                <BoardMemberAvatars
                  members={initialMembers}
                  align="start"
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 cursor-pointer px-2.5 [&_svg]:cursor-pointer"
              title="Share"
              aria-label="Share"
              onClick={() => setMembersOpen(true)}
            >
              <Share2 className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 cursor-pointer px-2.5 [&_svg]:cursor-pointer"
              title="Rename"
              aria-label="Rename"
              onClick={() => {
                setTitleDraft(initialTitle);
                setTitleError(null);
                setTitleOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            {isCreator && (
              <Button
                type="button"
                variant="dangerSecondary"
                size="sm"
                className="shrink-0 cursor-pointer px-2.5 [&_svg]:cursor-pointer"
                title="Delete"
                aria-label="Delete"
                onClick={() => setDeleteBoardOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>

      <section className="w-full min-w-0 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Todos
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTodoError(null);
            startTransition(async () => {
              const r = await createTodoAction(boardId, newTodoTitle, null);
              if (!r.ok) {
                setTodoError(r.error);
                return;
              }
              setNewTodoTitle("");
              router.refresh();
              queueMicrotask(() => {
                newTodoInputRef.current?.focus();
              });
            });
          }}
        >
          <div className="flex w-full min-w-0 flex-row items-stretch gap-2">
            <div className="min-w-0 flex-1">
              <Input
                ref={newTodoInputRef}
                id="new-todo"
                placeholder="New todo…"
                title="Type the todo title, then press Enter or click Add"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                className="py-1.5"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="shrink-0"
              title="Add todo"
              aria-label="Add todo"
            >
              Add
            </Button>
          </div>
        </form>
        {todoError && (
          <p className="text-sm text-danger" role="alert">
            {todoError}
          </p>
        )}
        {initialTodos.length === 0 ? (
          <p className="text-sm text-text-muted">No todos yet.</p>
        ) : (
          <>
            {openTodos.length === 0 ? (
              <p className="py-2 text-sm text-text-muted">No open todos.</p>
            ) : (
              <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-bg-default px-3 py-1">
                {openTodos.map((t) => (
                  <TaskboardTodoListRow
                    key={t.id}
                    t={t}
                    boardId={boardId}
                    pending={pending}
                    members={initialMembers}
                    grayedOut={false}
                    startTransition={startTransition}
                    onRefresh={refreshBoard}
                  />
                ))}
              </ul>
            )}
            {doneTodos.length > 0 ? (
              <div className="mt-8 space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Completed
                </h3>
                <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-bg-muted/30 px-3 py-1">
                  {doneTodos.map((t) => (
                    <TaskboardTodoListRow
                      key={t.id}
                      t={t}
                      boardId={boardId}
                      pending={pending}
                      members={initialMembers}
                      grayedOut
                      startTransition={startTransition}
                      onRefresh={refreshBoard}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Dialog
        open={membersOpen}
        onOpenChange={(open) => {
          setMembersOpen(open);
          if (!open) {
            setInviteQuery("");
            setInviteResults([]);
          }
        }}
        title="Members"
        contentClassName="max-w-md"
      >
        <div className="mt-6 max-h-[min(70vh,520px)] space-y-4 overflow-y-auto pr-1">
          <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-bg-default">
            {initialMembers.map((m) => {
              const displayName = (m.name && m.name.trim()) || m.email;
              const isBoardOwner = m.app_user_id === createdByAppUserId;
              const canRemove = isCreator && !isBoardOwner;
              return (
                <li
                  key={m.app_user_id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-text-primary">
                      {displayName}
                    </span>
                    {m.name && m.name.trim() && (
                      <span className="ml-2 text-xs text-text-muted">{m.email}</span>
                    )}
                    {isBoardOwner && (
                      <span className="ml-2 text-xs text-text-muted">(owner)</span>
                    )}
                  </div>
                  {canRemove && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2 text-danger"
                      title={`Remove ${displayName} from this board`}
                      aria-label={`Remove ${displayName} from this board`}
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const r = await removeBoardMemberAction(
                            boardId,
                            m.app_user_id
                          );
                          if (!r.ok) {
                            window.alert(r.error);
                            return;
                          }
                          router.refresh();
                        });
                      }}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {isCreator && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">
                Invite by email or name (must already exist as an app user).
              </p>
              <Input
                id="invite-search"
                placeholder="Search users…"
                title="Search existing users by name or email"
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                className="py-1.5"
              />
              {inviteBusy && (
                <p className="text-xs text-text-muted">Searching…</p>
              )}
              {inviteResults.length > 0 && (
                <ul className="space-y-1 rounded-md border border-border-subtle bg-bg-muted/40 p-2">
                  {inviteResults.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {(u.name && u.name.trim()) || u.email}
                        {u.name && (
                          <span className="text-text-muted"> · {u.email}</span>
                        )}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        title={`Add ${(u.name && u.name.trim()) || u.email} to this board`}
                        aria-label={`Add ${(u.name && u.name.trim()) || u.email} to this board`}
                        onClick={() => {
                          startTransition(async () => {
                            const r = await addBoardMemberAction(boardId, u.id);
                            if (!r.ok) {
                              window.alert(r.error);
                              return;
                            }
                            setInviteQuery("");
                            setInviteResults([]);
                            router.refresh();
                          });
                        }}
                      >
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={titleOpen}
        onOpenChange={setTitleOpen}
        title="Rename board"
        contentClassName="max-w-md"
      >
        <form
          className="modal-form-discreet mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTitleError(null);
            startTransition(async () => {
              const r = await updateBoardTitleAction(boardId, titleDraft);
              if (!r.ok) {
                setTitleError(r.error);
                return;
              }
              setTitleOpen(false);
              router.refresh();
            });
          }}
        >
          <Input
            id="board-title-edit"
            label="Title"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            modalStyle
          />
          {titleError && (
            <p className="text-sm text-danger" role="alert">
              {titleError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              title="Close without saving"
              onClick={() => setTitleOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} title="Save board title">
              Save
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmModal
        isOpen={deleteBoardOpen}
        title="Delete board?"
        message="This removes the board, all todos, and member links for everyone."
        confirmLabel="Delete"
        variant="danger"
        onClose={() => setDeleteBoardOpen(false)}
        onConfirm={async () => {
          const r = await deleteBoardAction(boardId);
          if (!r.ok) {
            window.alert(r.error);
            return;
          }
          router.push("/taskboard");
          router.refresh();
        }}
      />
    </div>
  );
}
