"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Plus, Send, X } from "lucide-react";
import {
  Button,
  InitialsAvatar,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { formatWorkTimestamp } from "@/lib/workTimeAgo";
import {
  WORK_FILE_MAX_BYTES,
  type WorkBoardView,
  type WorkIssue,
  type WorkPerson,
} from "@/lib/workTypes";
import {
  workStatusDotClass,
  type WorkIssueStatus,
} from "@/lib/workStatuses";
import {
  addWorkIssueAssigneeAction,
  addWorkIssueCommentAction,
  addWorkIssueLabelAction,
  addWorkIssueRelationAction,
  deleteWorkIssueCommentAction,
  deleteWorkIssueFileAction,
  removeWorkIssueAssigneeAction,
  removeWorkIssueLabelAction,
  removeWorkIssueRelationAction,
  updateWorkIssueCommentAction,
  updateWorkIssueEstimateAction,
  updateWorkIssueFieldAction,
  updateWorkIssueOwnerAction,
  updateWorkIssueTitleAction,
  uploadWorkIssueFileAction,
} from "../../actions";
import { WorkCommentComposer } from "./WorkCommentComposer";
import { WorkIssueComment } from "./WorkIssueComment";
import { WorkIssueRelations } from "./WorkIssueRelations";
import { WorkTimeGraph } from "./WorkTimeGraph";
import { encodeMentions } from "@/lib/workMentions";
import { formatWorkHours, parseWorkEstimateHours } from "@/lib/workTime";

const textFieldClass =
  "w-full resize-none border-0 bg-transparent px-0 py-1 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50";

const commentClass =
  "w-full rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal disabled:opacity-50";

const metaSelectTriggerClass =
  "h-8 !w-auto max-w-full border-0 bg-transparent px-0 py-0 text-sm font-medium text-text-primary hover:bg-transparent focus:border-transparent focus:ring-0";

function WorkMetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-4 py-1.5">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function WorkMetaSelect({
  label,
  value,
  onValueChange,
  options,
  disabled,
  prefix,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  prefix?: ReactNode;
}) {
  return (
    <WorkMetaRow label={label}>
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-form bg-bg-default py-0 pl-2.5 pr-1.5 hover:bg-interactive-secondary">
        {prefix}
        <Select
          value={value}
          onValueChange={onValueChange}
          options={options}
          disabled={disabled}
          variant="inlineEdit"
          className="w-fit min-w-0"
          triggerClassName={metaSelectTriggerClass}
        />
      </div>
    </WorkMetaRow>
  );
}

type Props = {
  board: WorkBoardView;
  issue: WorkIssue;
  onStatus: (status: WorkIssueStatus) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  onIssuePatch: (patch: Partial<WorkIssue>) => void;
};

export function WorkIssueDrawer({
  board,
  issue,
  onStatus,
  onChanged,
  onError,
  onIssuePatch,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState("details");
  const [feed, setFeed] = useState<"comments" | "activity">("comments");
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  const [currentState, setCurrentState] = useState(issue.currentState);
  const [nextStep, setNextStep] = useState(issue.nextStep);
  const [labelDraft, setLabelDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [addingLabel, setAddingLabel] = useState(false);
  const [estimateDraft, setEstimateDraft] = useState(
    issue.estimateHours == null ? "" : String(issue.estimateHours)
  );

  useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description);
    setCurrentState(issue.currentState);
    setNextStep(issue.nextStep);
    setEstimateDraft(
      issue.estimateHours == null ? "" : String(issue.estimateHours)
    );
  }, [
    issue.id,
    issue.title,
    issue.description,
    issue.currentState,
    issue.nextStep,
    issue.estimateHours,
  ]);

  const people = useMemo(() => {
    const list = [...board.people];
    if (issue.owner && !list.some((person) => person.id === issue.owner?.id)) {
      list.unshift(issue.owner);
    }
    return list;
  }, [board.people, issue.owner]);

  const addablePeople = useMemo(
    () =>
      people.filter(
        (person) => !issue.assignees.some((assignee) => assignee.id === person.id)
      ),
    [people, issue.assignees]
  );

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    options?: { refresh?: boolean }
  ) {
    const refresh = options?.refresh !== false;
    const execute = async () => {
      const result = await action();
      if (!result.ok) {
        onError(result.error);
        return;
      }
      if (refresh) onChanged();
    };
    if (refresh) {
      startTransition(execute);
    } else {
      void execute();
    }
  }

  function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === issue.title) {
      setTitle(issue.title);
      return;
    }
    onIssuePatch({ title: trimmed });
    run(() => updateWorkIssueTitleAction(board.id, issue.id, trimmed));
  }

  function saveField(
    field: "description" | "current_state" | "next_step",
    value: string,
    current: string
  ) {
    if (value === current) return;
    onIssuePatch(
      field === "description"
        ? { description: value }
        : field === "current_state"
          ? { currentState: value }
          : { nextStep: value }
    );
    run(() => updateWorkIssueFieldAction(board.id, issue.id, field, value));
  }

  function saveEstimate() {
    const parsed = parseWorkEstimateHours(estimateDraft);
    if (!parsed.ok) {
      setEstimateDraft(
        issue.estimateHours == null ? "" : String(issue.estimateHours)
      );
      onError("Estimate must be a number of hours");
      return;
    }
    const current = issue.estimateHours;
    if (parsed.value === current) {
      setEstimateDraft(current == null ? "" : String(current));
      return;
    }
    onIssuePatch({ estimateHours: parsed.value });
    run(() =>
      updateWorkIssueEstimateAction(
        board.id,
        issue.id,
        parsed.value == null ? "" : String(parsed.value)
      )
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <Input
          value={title}
          disabled={pending}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={saveTitle}
          aria-label="Issue title"
          className="border-0 bg-transparent px-0 text-heading-l focus:ring-0"
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="!gap-0">
            <TabsTrigger value="details" className="px-3 !px-3">
              Details
            </TabsTrigger>
            <TabsTrigger value="files" className="px-3 !px-3">
              Files {issue.files.length > 0 ? issue.files.length : ""}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-5">
            <WorkMetaSelect
              label="Status"
              value={issue.status}
              disabled={pending}
              prefix={
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${workStatusDotClass(
                    board.statuses.findIndex((row) => row.id === issue.status)
                  )}`}
                  aria-hidden
                />
              }
              onValueChange={(value) => onStatus(value as WorkIssueStatus)}
              options={board.statuses.map((status) => ({
                value: status.id,
                label: status.name,
              }))}
            />
            <WorkMetaSelect
              label="Owner"
              value={issue.owner?.id ?? ""}
              disabled={pending}
              prefix={
                issue.owner ? (
                  <InitialsAvatar
                    name={issue.owner.name}
                    initials={issue.owner.initials}
                    size="xs"
                    className="!h-5 !w-5 text-[9px]"
                  />
                ) : undefined
              }
              onValueChange={(value) => {
                const person = people.find((row) => row.id === value) ?? null;
                onIssuePatch({ owner: person });
                run(() =>
                  updateWorkIssueOwnerAction(
                    board.id,
                    issue.id,
                    value || null,
                    person?.name ?? "Unassigned"
                  )
                );
              }}
              options={[
                { value: "", label: "Unassigned" },
                ...people.map((person) => ({
                  value: person.id,
                  label: person.name,
                })),
              ]}
            />
            <WorkMetaRow label="Assignees">
              <div className="flex min-h-8 items-center gap-1.5">
                <span className="flex items-center -space-x-1.5">
                  {issue.assignees.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        onIssuePatch({
                          assignees: issue.assignees.filter(
                            (row) => row.id !== person.id
                          ),
                        });
                        run(
                          () =>
                            removeWorkIssueAssigneeAction(
                              board.id,
                              issue.id,
                              person.id,
                              person.name
                            ),
                          { refresh: false }
                        );
                      }}
                      title={`Remove ${person.name}`}
                      className="rounded-full"
                    >
                      <InitialsAvatar
                        name={person.name}
                        initials={person.initials}
                        size="xs"
                        className="ring-2 ring-bg-default"
                      />
                    </button>
                  ))}
                </span>
                {addingAssignee && addablePeople.length > 0 ? (
                  <Select
                    value=""
                    disabled={pending}
                    defaultOpen
                    placeholder="Add"
                    onValueChange={(value) => {
                      const person = people.find((row) => row.id === value);
                      setAddingAssignee(false);
                      if (!person) return;
                      onIssuePatch({ assignees: [...issue.assignees, person] });
                      run(
                        () =>
                          addWorkIssueAssigneeAction(
                            board.id,
                            issue.id,
                            person.id,
                            person.name
                          ),
                        { refresh: false }
                      );
                    }}
                    onBlur={() => setAddingAssignee(false)}
                    options={addablePeople.map((person) => ({
                      value: person.id,
                      label: person.name,
                    }))}
                    variant="inlineEdit"
                    className="min-w-0"
                    triggerClassName={metaSelectTriggerClass}
                  />
                ) : addablePeople.length > 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setAddingAssignee(true)}
                    aria-label="Add assignee"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle text-text-tertiary hover:bg-bg-muted hover:text-text-primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </WorkMetaRow>
            <WorkMetaRow label="Reporter">
              <p className="text-sm text-text-primary">{issue.reporter.name}</p>
            </WorkMetaRow>
            <WorkMetaRow label="Estimate">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={estimateDraft}
                  disabled={pending}
                  aria-label="Estimate in hours"
                  placeholder="—"
                  onChange={(event) => setEstimateDraft(event.target.value)}
                  onBlur={saveEstimate}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-8 w-14 border-0 bg-transparent px-0 text-sm font-medium tabular-nums text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
                />
                <span className="text-sm text-text-tertiary">h</span>
              </div>
            </WorkMetaRow>
            <WorkMetaRow label="Logged">
              <p className="text-sm tabular-nums text-text-primary">
                {formatWorkHours(issue.loggedHours)}
              </p>
            </WorkMetaRow>
            <div className="py-1.5">
              <WorkTimeGraph
                size="drawer"
                estimateHours={issue.estimateHours}
                loggedHours={issue.loggedHours}
              />
            </div>

            <div className="space-y-5 pt-6">
              <label className="block">
                <span className="mb-0.5 block text-[13px] text-text-secondary">
                  Description
                </span>
                <textarea
                  className={textFieldClass}
                  rows={2}
                  value={description}
                  disabled={pending}
                  placeholder="Add description…"
                  onChange={(event) => setDescription(event.target.value)}
                  onBlur={() =>
                    saveField("description", description, issue.description)
                  }
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[13px] text-text-secondary">
                  Current state
                </span>
                <textarea
                  className={textFieldClass}
                  rows={2}
                  value={currentState}
                  disabled={pending}
                  placeholder="Add current state…"
                  onChange={(event) => setCurrentState(event.target.value)}
                  onBlur={() =>
                    saveField("current_state", currentState, issue.currentState)
                  }
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[13px] text-text-secondary">
                  Next step
                </span>
                <textarea
                  className={textFieldClass}
                  rows={2}
                  value={nextStep}
                  disabled={pending}
                  placeholder="Add next step…"
                  onChange={(event) => setNextStep(event.target.value)}
                  onBlur={() => saveField("next_step", nextStep, issue.nextStep)}
                />
              </label>
              <div>
                <p className="mb-1.5 text-[13px] text-text-secondary">Labels</p>
                <div className="flex flex-wrap items-center gap-2">
                  {issue.labels.map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        onIssuePatch({
                          labels: issue.labels.filter((row) => row.id !== label.id),
                        });
                        run(() =>
                          removeWorkIssueLabelAction(
                            board.id,
                            issue.id,
                            label.id,
                            label.name
                          )
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-border-subtle px-2.5 py-1 text-label-s text-text-primary hover:bg-bg-muted"
                    >
                      {label.name}
                      <X className="h-3 w-3 text-text-tertiary" aria-hidden />
                    </button>
                  ))}
                  {addingLabel ? (
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const name = labelDraft.trim();
                        if (!name) return;
                        setLabelDraft("");
                        setAddingLabel(false);
                        run(() => addWorkIssueLabelAction(board.id, issue.id, name));
                      }}
                    >
                      <Input
                        value={labelDraft}
                        onChange={(event) => setLabelDraft(event.target.value)}
                        placeholder="Label name"
                        className="w-36 py-1.5"
                        disabled={pending}
                        autoFocus
                        onBlur={() => {
                          if (!labelDraft.trim()) setAddingLabel(false);
                        }}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setAddingLabel(true)}
                      className="text-[13px] text-text-secondary hover:text-text-primary"
                    >
                      + Add label
                    </button>
                  )}
                </div>
              </div>
              <WorkIssueRelations
                issue={issue}
                issues={board.issues}
                customerId={board.customerId}
                boardId={board.id}
                pending={pending}
                onAdd={(otherIssueId, role) => {
                  run(() =>
                    addWorkIssueRelationAction(
                      board.id,
                      issue.id,
                      otherIssueId,
                      role
                    )
                  );
                }}
                onRemove={(relationId) => {
                  run(() =>
                    removeWorkIssueRelationAction(
                      board.id,
                      issue.id,
                      relationId
                    )
                  );
                }}
              />
            </div>

            <div className="pt-6">
              <div className="flex gap-4 border-b border-border-subtle">
                <button
                  type="button"
                  className={`inline-flex items-center border-b-2 px-1 pb-2 text-sm font-medium ${
                    feed === "comments"
                      ? "border-text-primary text-text-primary"
                      : "border-transparent text-text-secondary"
                  }`}
                  onClick={() => setFeed("comments")}
                >
                  Comments
                  {issue.comments.length > 0 ? (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bg-muted px-1 text-[11px] font-medium tabular-nums text-text-secondary">
                      {issue.comments.length}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={`border-b-2 px-1 pb-2 text-sm font-medium ${
                    feed === "activity"
                      ? "border-text-primary text-text-primary"
                      : "border-transparent text-text-secondary"
                  }`}
                  onClick={() => setFeed("activity")}
                >
                  Activity
                </button>
              </div>
              {feed === "comments" ? (
                <ul className="mt-4 space-y-4">
                  {issue.comments.length === 0 ? (
                    <li className="text-sm text-text-secondary">No comments yet.</li>
                  ) : (
                    issue.comments.map((comment) => (
                      <WorkIssueComment
                        key={comment.id}
                        comment={comment}
                        canEdit={comment.author.id === board.currentUser.id}
                        people={board.members}
                        pending={pending}
                        onSave={(body) => {
                          onIssuePatch({
                            comments: issue.comments.map((row) =>
                              row.id === comment.id ? { ...row, body } : row
                            ),
                          });
                          run(() =>
                            updateWorkIssueCommentAction(
                              board.id,
                              issue.id,
                              comment.id,
                              body
                            )
                          );
                        }}
                        onDelete={() => {
                          onIssuePatch({
                            comments: issue.comments.filter(
                              (row) => row.id !== comment.id
                            ),
                          });
                          run(() =>
                            deleteWorkIssueCommentAction(
                              board.id,
                              issue.id,
                              comment.id
                            )
                          );
                        }}
                      />
                    ))
                  )}
                </ul>
              ) : (
                <ul className="mt-4 space-y-3">
                  {issue.events.length === 0 ? (
                    <li className="text-sm text-text-secondary">No activity yet.</li>
                  ) : (
                    issue.events.map((event) => (
                      <li
                        key={event.id}
                        className="flex items-baseline gap-3 text-body-m text-text-primary"
                      >
                        <p className="min-w-0 flex-1">
                          <span className="font-medium">{event.actor.name}</span>{" "}
                          {event.summary}
                        </p>
                        <time
                          dateTime={event.createdAt}
                          className="w-32 shrink-0 text-right text-text-tertiary"
                        >
                          {formatWorkTimestamp(event.createdAt)}
                        </time>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </TabsContent>
          <TabsContent value="files" className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text-primary">
                Upload a file
              </span>
              <input
                type="file"
                disabled={pending}
                className="text-sm text-text-secondary"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (file.size > WORK_FILE_MAX_BYTES) {
                    onError("File must be 8 MB or smaller");
                    return;
                  }
                  const formData = new FormData();
                  formData.set("file", file);
                  run(() =>
                    uploadWorkIssueFileAction(board.id, issue.id, formData)
                  );
                }}
              />
              <p className="mt-1 text-xs text-text-tertiary">Max 8 MB.</p>
            </label>
            {issue.files.length === 0 ? (
              <p className="text-sm text-text-secondary">No files yet.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {issue.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <a
                      href={`/api/work/files/${file.id}`}
                      className="min-w-0 truncate text-body-m text-text-primary hover:underline"
                    >
                      {file.fileName}
                      <span className="ml-2 text-text-tertiary">
                        {Math.max(1, Math.round(file.byteSize / 1024))} KB
                      </span>
                    </a>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-label-s text-text-secondary hover:text-danger"
                      onClick={() =>
                        run(() =>
                          deleteWorkIssueFileAction(board.id, issue.id, file.id)
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {tab === "details" ? (
      <form
        className="flex shrink-0 items-end gap-2 border-t border-border-subtle px-6 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          const body = encodeMentions(commentDraft.trim(), board.members);
          if (!body) return;
          setCommentDraft("");
          run(() => addWorkIssueCommentAction(board.id, issue.id, body));
        }}
      >
        <InitialsAvatar
          name={board.currentUser.name}
          initials={board.currentUser.initials}
          size="xs"
        />
        <WorkCommentComposer
          people={board.members}
          value={commentDraft}
          disabled={pending}
          className={`${commentClass} min-h-[5.5rem] resize-none`}
          onChange={setCommentDraft}
        />
        <Button type="submit" size="sm" disabled={pending || !commentDraft.trim()}>
          <Send className="h-4 w-4" aria-hidden />
          Send
        </Button>
      </form>
      ) : null}
    </div>
  );
}

const CARD_AVATAR_GAP =
  "shadow-[0_0_0_1.5px_var(--color-bg-default)]";
const CARD_OWNER_FRAME =
  "shadow-[0_0_0_1.5px_var(--color-bg-default),0_0_0_2.5px_var(--color-border-strong)]";

export function WorkCardPeople({
  owner,
  assignees,
}: {
  owner: WorkPerson | null;
  assignees: WorkPerson[];
}) {
  const extras = assignees.filter((person) => person.id !== owner?.id).slice(0, 3);
  if (!owner && extras.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center -space-x-1.5">
      {owner ? (
        <span title={`Owner: ${owner.name}`}>
          <InitialsAvatar
            name={owner.name}
            initials={owner.initials}
            size="xxs"
            className={CARD_OWNER_FRAME}
          />
        </span>
      ) : null}
      {extras.map((person) => (
        <span key={person.id} title={`Assignee: ${person.name}`}>
          <InitialsAvatar
            name={person.name}
            initials={person.initials}
            size="xxs"
            className={CARD_AVATAR_GAP}
          />
        </span>
      ))}
    </span>
  );
}
