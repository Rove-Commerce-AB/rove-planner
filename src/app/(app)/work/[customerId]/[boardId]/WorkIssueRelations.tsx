"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { workIssueHref } from "@/lib/routes";
import {
  type WorkRelatedIssue,
  type WorkRelationRole,
} from "@/lib/workIssueRelations";
import type { WorkIssue } from "@/lib/workTypes";

const ROLE_OPTIONS = [
  { value: "blocked_by", label: "Blocked by" },
  { value: "blocks", label: "Blocks" },
  { value: "relates", label: "Relates to" },
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
] as const;

function RelationGroup({
  title,
  issues,
  customerId,
  boardId,
  pending,
  onRemove,
}: {
  title: string;
  issues: WorkRelatedIssue[];
  customerId: string;
  boardId: string;
  pending: boolean;
  onRemove: (relationId: string) => void;
}) {
  if (issues.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-caption text-text-tertiary">{title}</p>
      <ul className="space-y-1">
        {issues.map((item) => (
          <li key={item.relationId} className="flex items-center gap-2">
            <Link
              href={workIssueHref(customerId, boardId, item.id)}
              prefetch={false}
              className="min-w-0 flex-1 truncate text-body-m text-text-primary hover:text-accent-primary-text"
            >
              <span className="text-text-tertiary">{item.key}</span>
              <span className="ml-1.5">{item.title}</span>
            </Link>
            <button
              type="button"
              disabled={pending}
              aria-label={`Remove ${title.toLowerCase()} ${item.key}`}
              className="text-text-tertiary hover:text-text-primary"
              onClick={() => onRemove(item.relationId)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkIssueRelations({
  issue,
  issues,
  customerId,
  boardId,
  pending,
  onAdd,
  onRemove,
}: {
  issue: WorkIssue;
  issues: WorkIssue[];
  customerId: string;
  boardId: string;
  pending: boolean;
  onAdd: (otherIssueId: string, role: WorkRelationRole) => void;
  onRemove: (relationId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState<WorkRelationRole>("blocked_by");
  const [query, setQuery] = useState("");
  const relations = issue.relations;

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return issues.filter((row) => {
      if (row.id === issue.id) return false;
      if (role === "parent" && relations.parent) return false;
      if (role === "child" && row.relations.parent) return false;
      if (role === "blocks" && relations.blocks.some((item) => item.id === row.id)) {
        return false;
      }
      if (
        role === "blocked_by" &&
        relations.blockedBy.some((item) => item.id === row.id)
      ) {
        return false;
      }
      if (role === "relates" && relations.relates.some((item) => item.id === row.id)) {
        return false;
      }
      if (!needle) return true;
      return (
        row.key.toLowerCase().includes(needle) ||
        row.title.toLowerCase().includes(needle)
      );
    });
  }, [issue.id, issues, query, relations, role]);

  const parent = relations.parent ? [relations.parent] : [];

  return (
    <div>
      <p className="mb-1.5 text-[13px] text-text-secondary">Relations</p>
      <div className="space-y-3">
        <RelationGroup
          title="Parent"
          issues={parent}
          customerId={customerId}
          boardId={boardId}
          pending={pending}
          onRemove={onRemove}
        />
        <RelationGroup
          title="Children"
          issues={relations.children}
          customerId={customerId}
          boardId={boardId}
          pending={pending}
          onRemove={onRemove}
        />
        <RelationGroup
          title="Blocks"
          issues={relations.blocks}
          customerId={customerId}
          boardId={boardId}
          pending={pending}
          onRemove={onRemove}
        />
        <RelationGroup
          title="Blocked by"
          issues={relations.blockedBy}
          customerId={customerId}
          boardId={boardId}
          pending={pending}
          onRemove={onRemove}
        />
        <RelationGroup
          title="Relates to"
          issues={relations.relates}
          customerId={customerId}
          boardId={boardId}
          pending={pending}
          onRemove={onRemove}
        />
        {adding ? (
          <div className="space-y-2 rounded-lg border border-border-subtle p-2">
            <Select
              value={role}
              onValueChange={(value) => setRole(value as WorkRelationRole)}
              options={ROLE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              disabled={pending}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search issues…"
              aria-label="Search issues to relate"
              autoFocus
              disabled={pending}
            />
            <ul className="max-h-40 overflow-y-auto">
              {candidates.length === 0 ? (
                <li className="px-1 py-1.5 text-body-m text-text-tertiary">
                  No matching issues
                </li>
              ) : (
                candidates.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={pending}
                      className="flex w-full truncate px-1 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
                      onClick={() => {
                        onAdd(row.id, role);
                        setQuery("");
                        setAdding(false);
                      }}
                    >
                      <span className="text-text-tertiary">{row.key}</span>
                      <span className="ml-1.5 truncate">{row.title}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              className="text-[13px] text-text-secondary hover:text-text-primary"
              onClick={() => {
                setAdding(false);
                setQuery("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            className="text-[13px] text-text-secondary hover:text-text-primary"
            onClick={() => setAdding(true)}
          >
            + Add relation
          </button>
        )}
      </div>
    </div>
  );
}
