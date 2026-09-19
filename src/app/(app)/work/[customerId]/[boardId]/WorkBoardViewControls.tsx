"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Group, ListFilter, User } from "lucide-react";
import { InitialsAvatar } from "@/components/ui";
import {
  UNASSIGNED_OWNER_ID,
  groupByTriggerLabel,
  type WorkBoardGroupBy,
  type WorkColumnGroup,
} from "@/lib/workBoardView";
import type { WorkLabel, WorkPerson } from "@/lib/workTypes";

type Menu = {
  kind: "filter" | "group";
  top: number;
  left: number;
};

const MENU_WIDTH = 224;

function menuLeft(rect: DOMRect) {
  return Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8);
}

function triggerClass(active: boolean) {
  return `inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors ${
    active
      ? "bg-accent-primary-subtle text-accent-primary-text"
      : "text-text-secondary hover:bg-bg-muted hover:text-text-primary"
  }`;
}

export function WorkCardLabels({ labels }: { labels: WorkLabel[] }) {
  if (labels.length === 0) return null;
  return (
    <p className="mt-1.5 truncate text-caption text-text-tertiary">
      {labels.map((label) => label.name).join(" · ")}
    </p>
  );
}

export function WorkColumnGroupHeader({
  groupBy,
  group,
  className = "",
}: {
  groupBy: WorkBoardGroupBy;
  group: WorkColumnGroup;
  className?: string;
}) {
  if (groupBy === "none") return null;
  return (
    <div className={`flex items-center gap-1.5 px-0.5 ${className}`.trim()}>
      {groupBy === "owner" ? (
        group.owner ? (
          <InitialsAvatar
            name={group.owner.name}
            initials={group.owner.initials}
            size="xxs"
          />
        ) : (
          <span
            aria-hidden
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border-default text-text-tertiary"
          >
            <User className="h-3 w-3" />
          </span>
        )
      ) : null}
      <span className="min-w-0 truncate text-label-s text-text-secondary">
        {group.title}
      </span>
      <span className="tabular-nums text-body-xs text-text-tertiary">
        {group.issues.length}
      </span>
    </div>
  );
}

export function WorkBoardViewControls({
  people,
  ownerFilterIds,
  onOwnerFilterChange,
  groupBy,
  onGroupByChange,
}: {
  people: WorkPerson[];
  ownerFilterIds: string[];
  onOwnerFilterChange: (ids: string[]) => void;
  groupBy: WorkBoardGroupBy;
  onGroupByChange: (value: WorkBoardGroupBy) => void;
}) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const filterActive = ownerFilterIds.length > 0;
  const groupActive = groupBy !== "none";
  const selectedOwners = new Set(ownerFilterIds);
  const filterLabel = filterSummary(people, ownerFilterIds);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-board-view-menu]")
      ) {
        return;
      }
      setMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  function openMenu(kind: Menu["kind"], event: React.MouseEvent<HTMLButtonElement>) {
    if (menu?.kind === kind) {
      setMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ kind, top: rect.bottom + 4, left: menuLeft(rect) });
  }

  function toggleOwner(id: string) {
    if (selectedOwners.has(id)) {
      onOwnerFilterChange(ownerFilterIds.filter((value) => value !== id));
      return;
    }
    onOwnerFilterChange([...ownerFilterIds, id]);
  }

  return (
    <>
      <button
        type="button"
        data-board-view-menu
        aria-label="Filter issues"
        aria-expanded={menu?.kind === "filter"}
        aria-haspopup="menu"
        className={triggerClass(filterActive)}
        onClick={(event) => openMenu("filter", event)}
      >
        <ListFilter className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-28 truncate">{filterLabel}</span>
      </button>
      <button
        type="button"
        data-board-view-menu
        aria-label="Group issues"
        aria-expanded={menu?.kind === "group"}
        aria-haspopup="menu"
        className={triggerClass(groupActive)}
        onClick={(event) => openMenu("group", event)}
      >
        <Group className="h-3.5 w-3.5" aria-hidden />
        <span>{groupByTriggerLabel(groupBy)}</span>
      </button>
      {menu
        ? createPortal(
            <div
              data-board-view-menu
              role="menu"
              className="fixed z-50 min-w-56 rounded-lg border border-border-subtle bg-bg-default py-1 shadow-lg"
              style={{ top: menu.top, left: menu.left, width: MENU_WIDTH }}
            >
              {menu.kind === "filter" ? (
                <>
                  <p className="px-3 py-1.5 text-label-s text-text-tertiary">
                    Filter by owner
                  </p>
                  <MenuRow
                    selected={selectedOwners.has(UNASSIGNED_OWNER_ID)}
                    onSelect={() => toggleOwner(UNASSIGNED_OWNER_ID)}
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border-default text-text-tertiary"
                    >
                      <User className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 truncate">Unassigned</span>
                  </MenuRow>
                  {people.map((person) => (
                    <MenuRow
                      key={person.id}
                      selected={selectedOwners.has(person.id)}
                      onSelect={() => toggleOwner(person.id)}
                    >
                      <InitialsAvatar
                        name={person.name}
                        initials={person.initials}
                        size="xxs"
                      />
                      <span className="min-w-0 truncate">{person.name}</span>
                    </MenuRow>
                  ))}
                  {filterActive ? (
                    <button
                      type="button"
                      className="mt-1 flex w-full border-t border-border-subtle px-3 py-1.5 text-left text-body-m text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                      onClick={() => {
                        onOwnerFilterChange([]);
                        setMenu(null);
                      }}
                    >
                      Clear filter
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="px-3 py-1.5 text-label-s text-text-tertiary">
                    Group by
                  </p>
                  <MenuRow
                    selected={groupBy === "none"}
                    onSelect={() => {
                      onGroupByChange("none");
                      setMenu(null);
                    }}
                  >
                    No grouping
                  </MenuRow>
                  <MenuRow
                    selected={groupBy === "owner"}
                    onSelect={() => {
                      onGroupByChange("owner");
                      setMenu(null);
                    }}
                  >
                    Owner
                  </MenuRow>
                  <MenuRow
                    selected={groupBy === "label"}
                    onSelect={() => {
                      onGroupByChange("label");
                      setMenu(null);
                    }}
                  >
                    Label
                  </MenuRow>
                </>
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function filterSummary(people: WorkPerson[], ownerFilterIds: string[]) {
  if (ownerFilterIds.length === 0) return "Filter";
  if (ownerFilterIds.length === 1) {
    const id = ownerFilterIds[0];
    if (id === UNASSIGNED_OWNER_ID) return "Unassigned";
    return people.find((person) => person.id === id)?.name ?? "Filter";
  }
  return `Filter · ${ownerFilterIds.length}`;
}

function MenuRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={selected}
      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
      onClick={onSelect}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      <Check
        className={`h-3.5 w-3.5 shrink-0 ${
          selected ? "text-text-primary" : "text-transparent"
        }`}
        aria-hidden
      />
    </button>
  );
}
