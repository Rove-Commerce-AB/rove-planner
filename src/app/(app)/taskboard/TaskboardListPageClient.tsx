"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  BoardMemberAvatars,
  type BoardMemberAvatarMember,
} from "@/components/taskboard/BoardMemberAvatars";
import { createBoardAction } from "./actions";

export type TaskboardListMember = BoardMemberAvatarMember;

export type TaskboardListBoard = {
  id: string;
  title: string;
  created_by_app_user_id: string;
  creator_label: string;
  created_at: string;
  updated_at: string;
  members: TaskboardListMember[];
};

type Props = {
  boards: TaskboardListBoard[];
};

export function TaskboardListPageClient({ boards }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          size="sm"
          title="Create a new board"
          aria-label="Create a new board"
          onClick={() => {
            setNewTitle("");
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New board
        </Button>
      </div>

      {boards.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-bg-default px-4 py-8 text-center text-sm text-text-muted">
          No boards yet. Create one to get started.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((b) => (
            <li key={b.id} className="flex min-h-0 h-full">
              <Link
                href={`/taskboard/${b.id}`}
                title={`View board: ${b.title}`}
                className="flex h-full min-h-[7.5rem] w-full flex-col rounded-xl border border-border-subtle bg-bg-default p-5 shadow-sm transition-colors hover:border-brand-signal/50 hover:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-content)]"
              >
                <h2
                  className="line-clamp-2 min-h-0 flex-1 text-base font-semibold leading-snug text-text-primary"
                  title={b.title}
                >
                  {b.title}
                </h2>
                {b.members.length > 0 ? (
                  <div className="mt-4 flex shrink-0 justify-end">
                    <BoardMemberAvatars members={b.members} />
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New board"
        contentClassName="max-w-md"
      >
        <form
          className="modal-form-discreet mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setCreateError(null);
            startTransition(async () => {
              const r = await createBoardAction(newTitle);
              if (!r.ok) {
                setCreateError(r.error);
                return;
              }
              setCreateOpen(false);
              setNewTitle("");
              router.push(`/taskboard/${r.boardId}`);
              router.refresh();
            });
          }}
        >
          <Input
            id="new-board-title"
            label="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Board name"
            title="Name for the new board"
            modalStyle
            autoFocus
          />
          {createError && (
            <p className="text-sm text-danger" role="alert">
              {createError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              title="Close without creating a board"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} title="Create board with this title">
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
