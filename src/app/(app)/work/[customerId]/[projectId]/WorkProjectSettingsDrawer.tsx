"use client";

import { useEffect, useState } from "react";
import { Button, Input, SideDrawer } from "@/components/ui";
import type { WorkPerson } from "@/lib/workTypes";
import { WorkBoardMembers } from "./WorkBoardMembers";

export function WorkProjectSettingsDrawer({
  open,
  onOpenChange,
  title,
  customerName,
  members,
  people,
  onRename,
  onAddMember,
  onRemoveMember,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  customerName: string;
  members: WorkPerson[];
  people: WorkPerson[];
  onRename: (nextTitle: string) => Promise<boolean>;
  onAddMember: (person: WorkPerson) => void;
  onRemoveMember: (person: WorkPerson) => void;
  onArchive: () => void;
}) {
  const [nameDraft, setNameDraft] = useState(title);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (open) setNameDraft(title);
  }, [open, title]);

  async function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === title) {
      setNameDraft(title);
      return;
    }
    setSavingName(true);
    const ok = await onRename(trimmed);
    setSavingName(false);
    if (!ok) setNameDraft(title);
  }

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Project settings"
      subtitle={customerName}
      bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <Input
            id="work-project-settings-name"
            label="Name"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={() => {
              void commitName();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setNameDraft(title);
                (event.target as HTMLInputElement).blur();
              }
            }}
            disabled={savingName}
            modalStyle
          />

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-text-primary">Access</h2>
            <WorkBoardMembers
              members={members}
              people={people}
              layout="list"
              onAdd={onAddMember}
              onRemove={onRemoveMember}
            />
          </section>
        </div>

        <div className="mt-auto shrink-0 border-t border-border-subtle px-6 py-5">
          <h2 className="text-sm font-medium text-text-primary">Danger zone</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Archive hides this project from Rove Work. Issues are kept.
          </p>
          <Button
            type="button"
            variant="danger"
            className="mt-3"
            onClick={onArchive}
          >
            Archive project
          </Button>
        </div>
      </div>
    </SideDrawer>
  );
}
