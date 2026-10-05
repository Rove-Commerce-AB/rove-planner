"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { InitialsAvatar } from "@/components/ui";
import type { WorkPerson } from "@/lib/workTypes";

export function WorkBoardMembers({
  members,
  people,
  disabled,
  layout = "stack",
  onAdd,
  onRemove,
  onOpenSettings,
}: {
  members: WorkPerson[];
  people: WorkPerson[];
  disabled?: boolean;
  /** stack = toolbar avatars; list = settings rows; summary = read-only stack that opens settings */
  layout?: "stack" | "list" | "summary";
  onAdd?: (person: WorkPerson) => void;
  onRemove?: (person: WorkPerson) => void;
  onOpenSettings?: () => void;
}) {
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const addable = useMemo(() => {
    const taken = new Set(members.map((person) => person.id));
    return people.filter((person) => !taken.has(person.id));
  }, [members, people]);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-board-add-person]")) {
        return;
      }
      setMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menu]);

  if (layout === "summary") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onOpenSettings}
        aria-label="Project access"
        title="Project access"
        className="flex h-7 items-center gap-1.5 rounded-md px-0.5 hover:bg-bg-muted"
      >
        <span className="flex items-center -space-x-1.5">
          {members.map((person) => (
            <InitialsAvatar
              key={person.id}
              name={person.name}
              initials={person.initials}
              size="xs"
              className="shadow-[0_0_0_1.5px_var(--color-bg-default)]"
            />
          ))}
        </span>
      </button>
    );
  }

  if (layout === "list") {
    return (
      <div className="space-y-1" aria-label="Project access">
        <ul className="space-y-1">
          {members.map((person) => (
            <li key={person.id}>
              <div className="flex items-center gap-2 rounded-md px-1 py-1.5">
                <InitialsAvatar
                  name={person.name}
                  initials={person.initials}
                  size="xs"
                  className="!h-6 !w-6 text-[9px]"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                  {person.name}
                </span>
                <button
                  type="button"
                  disabled={disabled || members.length <= 1}
                  className="shrink-0 text-label-s text-text-tertiary hover:text-danger disabled:opacity-40"
                  onClick={() => onRemove?.(person)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        {addable.length > 0 ? (
          <>
            <button
              type="button"
              data-board-add-person
              disabled={disabled}
              onClick={(event) => {
                if (menu) {
                  setMenu(null);
                  return;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                setMenu({ top: rect.bottom + 4, left: rect.left });
              }}
              aria-label="Add person"
              aria-expanded={menu != null}
              aria-haspopup="listbox"
              className="mt-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1.5 text-sm text-text-secondary hover:bg-bg-muted hover:text-text-primary"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add person
            </button>
            {menu
              ? createPortal(
                  <div
                    data-board-add-person
                    role="listbox"
                    aria-label="Add person"
                    className="fixed z-50 max-h-60 min-w-44 overflow-y-auto rounded-lg border border-border-subtle bg-bg-default py-1 shadow-lg"
                    style={{ top: menu.top, left: menu.left }}
                  >
                    {addable.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        role="option"
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
                        onClick={() => {
                          onAdd?.(person);
                          setMenu(null);
                        }}
                      >
                        <InitialsAvatar
                          name={person.name}
                          initials={person.initials}
                          size="xxs"
                        />
                        <span className="truncate">{person.name}</span>
                      </button>
                    ))}
                  </div>,
                  document.body
                )
              : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-7 items-center gap-1.5" aria-label="Board access">
      <span className="flex items-center -space-x-1.5">
        {members.map((person) => (
          <button
            key={person.id}
            type="button"
            disabled={disabled}
            title={`Remove ${person.name}`}
            onClick={() => onRemove?.(person)}
            className="rounded-full"
          >
            <InitialsAvatar
              name={person.name}
              initials={person.initials}
              size="xs"
              className="shadow-[0_0_0_1.5px_var(--color-bg-default)]"
            />
          </button>
        ))}
      </span>
      {addable.length > 0 ? (
        <button
          type="button"
          data-board-add-person
          disabled={disabled}
          onClick={(event) => {
            if (menu) {
              setMenu(null);
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu({ top: rect.bottom + 4, left: rect.left });
          }}
          aria-label="Add person"
          aria-expanded={menu != null}
          aria-haspopup="listbox"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle text-text-tertiary hover:bg-bg-muted hover:text-text-primary"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
      {menu
        ? createPortal(
            <div
              data-board-add-person
              role="listbox"
              aria-label="Add person"
              className="fixed z-50 max-h-60 min-w-44 overflow-y-auto rounded-lg border border-border-subtle bg-bg-default py-1 shadow-lg"
              style={{ top: menu.top, left: menu.left }}
            >
              {addable.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
                  onClick={() => {
                    onAdd?.(person);
                    setMenu(null);
                  }}
                >
                  <InitialsAvatar
                    name={person.name}
                    initials={person.initials}
                    size="xxs"
                  />
                  <span className="truncate">{person.name}</span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
