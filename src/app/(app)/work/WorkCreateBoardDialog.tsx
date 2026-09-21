"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, InitialsAvatar, Input, SelectAllNone } from "@/components/ui";
import { workBoardHref } from "@/lib/routes";
import { suggestWorkBoardPrefix } from "@/lib/workIssueKey";
import type { WorkPerson } from "@/lib/workTypes";
import {
  createWorkBoardAction,
  listWorkCustomerPeopleAction,
} from "./actions";

type Customer = {
  id: string;
  name: string;
};

export function WorkCreateBoardDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [prefix, setPrefix] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<WorkPerson[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !customer) return;
    setTitle("");
    setPrefix(suggestWorkBoardPrefix(customer.name));
    setError(null);
    setPeople([]);
    setMemberIds([]);
    void listWorkCustomerPeopleAction(customer.id).then((rows) => {
      setPeople(rows);
      setMemberIds(rows.map((person) => person.id));
    });
  }, [customer, open]);

  function toggleMember(id: string) {
    setMemberIds((current) =>
      current.includes(id)
        ? current.filter((row) => row !== id)
        : [...current, id]
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={customer ? `New board · ${customer.name}` : "New board"}
      contentClassName="max-w-md"
    >
      <form
        className="modal-form-discreet mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!customer) return;
          setError(null);
          startTransition(async () => {
            const result = await createWorkBoardAction(
              customer.id,
              title,
              prefix,
              memberIds
            );
            if (!result.ok) {
              setError(result.error);
              return;
            }
            onOpenChange(false);
            router.push(workBoardHref(customer.id, result.boardId));
            router.refresh();
          });
        }}
      >
        <Input
          id="new-work-board-title"
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Board name"
          modalStyle
          autoFocus
        />
        <Input
          id="new-work-board-prefix"
          label="Issue prefix"
          value={prefix}
          onChange={(event) => setPrefix(event.target.value.toUpperCase())}
          placeholder="RT"
          title="Used for issue keys on this board, e.g. RT-12"
          modalStyle
        />
        {people.length > 0 ? (
          <fieldset className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <legend className="text-label-s text-text-secondary">Access</legend>
              <SelectAllNone
                ids={people.map((person) => person.id)}
                selectedIds={memberIds}
                onSelectedIdsChange={setMemberIds}
                disabled={pending}
              />
            </div>
            <ul className="max-h-52 space-y-1 overflow-y-auto">
              {people.map((person) => {
                const checked = memberIds.includes(person.id);
                return (
                  <li key={person.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-bg-muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(person.id)}
                        className="h-4 w-4 rounded border-border-form"
                      />
                      <InitialsAvatar
                        name={person.name}
                        initials={person.initials}
                        size="xs"
                        className="!h-6 !w-6 text-[9px]"
                      />
                      <span className="min-w-0 truncate text-sm text-text-primary">
                        {person.name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
