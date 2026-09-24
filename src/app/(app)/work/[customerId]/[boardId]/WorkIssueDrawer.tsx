"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
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
  joinWorkInlineImages,
  splitWorkInlineImages,
  workFileImageHref,
} from "@/lib/workInlineImages";
import {
  WORK_FILE_MAX_BYTES,
  type WorkBoardView,
  type WorkIssue,
  type WorkIssuePriority,
  type WorkPerson,
  type WorkRequirement,
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
  addWorkIssueReferenceAction,
  addWorkIssueRequirementAction,
  deleteWorkIssueCommentAction,
  deleteWorkIssueFileAction,
  deleteWorkIssueReferenceAction,
  deleteWorkIssueRequirementAction,
  removeWorkIssueAssigneeAction,
  removeWorkIssueLabelAction,
  removeWorkIssueRelationAction,
  updateWorkIssueCommentAction,
  updateWorkIssueEstimateAction,
  updateWorkIssueFieldAction,
  updateWorkIssueOwnerAction,
  updateWorkIssuePriorityAction,
  updateWorkIssueRequirementBodyAction,
  updateWorkIssueRequirementDoneAction,
  updateWorkIssueTitleAction,
  uploadWorkIssueFileAction,
} from "../../actions";
import { WorkCommentComposer, WorkInlineImageThumbs } from "./WorkCommentComposer";
import { WorkIssueComment } from "./WorkIssueComment";
import { WorkIssueRelations } from "./WorkIssueRelations";
import { WorkTimeGraph } from "./WorkTimeGraph";
import { encodeMentions } from "@/lib/workMentions";
import { formatWorkHours, parseWorkEstimateHours } from "@/lib/workTime";

const textFieldClass =
  "w-full resize-none overflow-hidden border-0 bg-transparent px-0 py-1 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50";

const commentClass =
  "w-full rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal disabled:opacity-50";

const metaSelectTriggerClass =
  "h-8 !w-auto max-w-full border-0 bg-transparent px-0 py-0 text-sm font-medium text-text-primary hover:bg-transparent focus:border-transparent focus:ring-0";

function AutosizeTextarea({
  value,
  className,
  minRows = 2,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      rows={minRows}
      className={className}
    />
  );
}

function isImageMime(mimeType: string) {
  return mimeType.toLowerCase().startsWith("image/");
}

function pasteFileName(file: File, index: number) {
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/gif"
          ? "gif"
          : file.type === "image/webp"
            ? "webp"
            : file.name.includes(".")
              ? file.name.split(".").pop()!
              : "png";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return file.name && !file.name.startsWith("image")
    ? file.name
    : `paste-${stamp}${index > 0 ? `-${index + 1}` : ""}.${ext}`;
}

function workFileHref(fileId: string) {
  return workFileImageHref(fileId);
}

type PasteZone = "description" | "comment";

type InlinePasteThumb = {
  localId: string;
  previewUrl: string;
  fileId: string | null;
  uploading: boolean;
  revokeOnClear: boolean;
};

function pasteZoneFromTarget(target: EventTarget | null): PasteZone | null {
  if (!(target instanceof Element)) return null;
  const zone = target.closest("[data-paste-zone]")?.getAttribute("data-paste-zone");
  if (zone === "description" || zone === "comment") return zone;
  return null;
}

function thumbsFromFileIds(fileIds: string[]): InlinePasteThumb[] {
  return fileIds.map((fileId) => ({
    localId: fileId,
    previewUrl: workFileImageHref(fileId),
    fileId,
    uploading: false,
    revokeOnClear: false,
  }));
}

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

function referenceHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function RequirementsChecklistSection({
  title,
  description,
  emptyLabel,
  placeholder,
  items,
  draft,
  onDraftChange,
  editingId,
  editingValue,
  pending,
  onEditingIdChange,
  onEditingValueChange,
  onToggle,
  onSaveBody,
  onRemove,
  onAdd,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  placeholder: string;
  items: WorkRequirement[];
  draft: string;
  onDraftChange: (value: string) => void;
  editingId: string | null;
  editingValue: string;
  pending: boolean;
  onEditingIdChange: (id: string | null) => void;
  onEditingValueChange: (value: string) => void;
  onToggle: (item: WorkRequirement, isDone: boolean) => void;
  onSaveBody: (item: WorkRequirement, body: string) => void;
  onRemove: (item: WorkRequirement) => void;
  onAdd: (body: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-tertiary">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((requirement) => {
            const editing = editingId === requirement.id;
            return (
              <li
                key={requirement.id}
                className="flex items-start gap-2 rounded-lg border border-border-subtle px-2.5 py-2"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border-form"
                  checked={requirement.isDone}
                  disabled={pending}
                  aria-label={`Mark ${requirement.isDone ? "incomplete" : "done"}`}
                  onChange={() => onToggle(requirement, !requirement.isDone)}
                />
                {editing ? (
                  <input
                    value={editingValue}
                    disabled={pending}
                    autoFocus
                    className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm text-text-primary focus:outline-none focus:ring-0"
                    onChange={(event) =>
                      onEditingValueChange(event.target.value)
                    }
                    onBlur={() => {
                      const trimmed = editingValue.trim();
                      onEditingIdChange(null);
                      if (!trimmed || trimmed === requirement.body) {
                        onEditingValueChange("");
                        return;
                      }
                      onSaveBody(requirement, trimmed);
                      onEditingValueChange("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        onEditingIdChange(null);
                        onEditingValueChange("");
                      }
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    className={`min-w-0 flex-1 text-left text-sm ${
                      requirement.isDone
                        ? "text-text-tertiary line-through"
                        : "text-text-primary"
                    }`}
                    onClick={() => {
                      onEditingIdChange(requirement.id);
                      onEditingValueChange(requirement.body);
                    }}
                  >
                    {requirement.body}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  className="shrink-0 text-label-s text-text-secondary hover:text-danger"
                  aria-label="Remove item"
                  onClick={() => onRemove(requirement)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (!trimmed) return;
          onAdd(trimmed);
        }}
      >
        <input
          value={draft}
          disabled={pending}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <Button type="submit" disabled={pending || !draft.trim()}>
          Add
        </Button>
      </form>
    </div>
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
  const [description, setDescription] = useState(
    () => splitWorkInlineImages(issue.description).text
  );
  const [descriptionThumbs, setDescriptionThumbs] = useState<InlinePasteThumb[]>(
    () => thumbsFromFileIds(splitWorkInlineImages(issue.description).fileIds)
  );
  const [currentState, setCurrentState] = useState(issue.currentState);
  const [nextStep, setNextStep] = useState(issue.nextStep);
  const [labelDraft, setLabelDraft] = useState("");
  const [requirementDraft, setRequirementDraft] = useState("");
  const [dodDraft, setDodDraft] = useState("");
  const [outOfScope, setOutOfScope] = useState(issue.outOfScope);
  const [referenceUrlDraft, setReferenceUrlDraft] = useState("");
  const [referenceLabelDraft, setReferenceLabelDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentThumbs, setCommentThumbs] = useState<InlinePasteThumb[]>([]);
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [addingLabel, setAddingLabel] = useState(false);
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(
    null
  );
  const [editingRequirementValue, setEditingRequirementValue] = useState("");
  const [estimateDraft, setEstimateDraft] = useState(
    issue.estimateHours == null ? "" : String(issue.estimateHours)
  );
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadBarVisible, setUploadBarVisible] = useState(false);
  const uploadingCountRef = useRef(0);
  const uploadStartedAtRef = useRef(0);
  const uploadHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const descriptionRef = useRef(description);
  descriptionRef.current = description;
  const issueDescriptionRef = useRef(issue.description);
  issueDescriptionRef.current = issue.description;

  function clearThumbs(thumbs: InlinePasteThumb[]) {
    for (const thumb of thumbs) {
      if (thumb.revokeOnClear) URL.revokeObjectURL(thumb.previewUrl);
    }
  }

  function persistDescription(thumbs: InlinePasteThumb[]) {
    const next = joinWorkInlineImages(
      descriptionRef.current,
      thumbs
        .map((thumb) => thumb.fileId)
        .filter((id): id is string => Boolean(id))
    );
    if (next === issueDescriptionRef.current) return;
    onIssuePatch({ description: next });
    run(() =>
      updateWorkIssueFieldAction(board.id, issue.id, "description", next)
    );
  }

  useEffect(() => {
    const split = splitWorkInlineImages(issue.description);
    setTitle(issue.title);
    setDescription(split.text);
    setDescriptionThumbs((prev) => {
      const fromServer = thumbsFromFileIds(split.fileIds);
      const pending = prev.filter(
        (thumb) =>
          thumb.uploading ||
          (thumb.fileId != null && !split.fileIds.includes(thumb.fileId))
      );
      for (const thumb of prev) {
        if (
          thumb.revokeOnClear &&
          !pending.some((row) => row.localId === thumb.localId)
        ) {
          URL.revokeObjectURL(thumb.previewUrl);
        }
      }
      const pendingNew = pending.filter(
        (thumb) =>
          !fromServer.some(
            (row) => row.fileId && row.fileId === thumb.fileId
          )
      );
      return [...fromServer, ...pendingNew];
    });
    setCurrentState(issue.currentState);
    setNextStep(issue.nextStep);
    setOutOfScope(issue.outOfScope);
    setEstimateDraft(
      issue.estimateHours == null ? "" : String(issue.estimateHours)
    );
  }, [
    issue.id,
    issue.title,
    issue.description,
    issue.currentState,
    issue.nextStep,
    issue.outOfScope,
    issue.estimateHours,
  ]);

  useEffect(() => {
    uploadingCountRef.current = 0;
    setUploadingCount(0);
    setUploadBarVisible(false);
    uploadStartedAtRef.current = 0;
    if (uploadHideTimeoutRef.current) {
      clearTimeout(uploadHideTimeoutRef.current);
      uploadHideTimeoutRef.current = null;
    }
    setCommentThumbs((prev) => {
      clearThumbs(prev);
      return [];
    });
    setCommentDraft("");
  }, [issue.id]);

  useEffect(() => {
    return () => {
      if (uploadHideTimeoutRef.current) {
        clearTimeout(uploadHideTimeoutRef.current);
      }
    };
  }, []);

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
    field: "description" | "current_state" | "next_step" | "out_of_scope",
    value: string,
    current: string
  ) {
    if (value === current) return;
    onIssuePatch(
      field === "description"
        ? { description: value }
        : field === "current_state"
          ? { currentState: value }
          : field === "next_step"
            ? { nextStep: value }
            : { outOfScope: value }
    );
    run(() => updateWorkIssueFieldAction(board.id, issue.id, field, value));
  }

  function saveDescription() {
    const next = joinWorkInlineImages(
      description,
      descriptionThumbs
        .map((thumb) => thumb.fileId)
        .filter((id): id is string => Boolean(id))
    );
    saveField("description", next, issue.description);
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

  function uploadFile(
    file: File,
    options?: { zone?: PasteZone; localId?: string; previewUrl?: string }
  ) {
    if (file.size > WORK_FILE_MAX_BYTES) {
      onError("File must be 8 MB or smaller");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    if (uploadingCountRef.current === 0) {
      uploadStartedAtRef.current = Date.now();
      if (uploadHideTimeoutRef.current) {
        clearTimeout(uploadHideTimeoutRef.current);
        uploadHideTimeoutRef.current = null;
      }
      setUploadBarVisible(true);
    }
    uploadingCountRef.current += 1;
    setUploadingCount(uploadingCountRef.current);
    void uploadWorkIssueFileAction(board.id, issue.id, formData).then(
      (result) => {
        uploadingCountRef.current = Math.max(0, uploadingCountRef.current - 1);
        setUploadingCount(uploadingCountRef.current);
        if (uploadingCountRef.current === 0) {
          const elapsed = Date.now() - uploadStartedAtRef.current;
          const remaining = Math.max(0, 500 - elapsed);
          uploadHideTimeoutRef.current = setTimeout(() => {
            setUploadBarVisible(false);
            uploadHideTimeoutRef.current = null;
          }, remaining);
        }
        if (!result.ok) {
          onError(result.error);
          if (options?.zone && options.localId) {
            const setThumbs =
              options.zone === "description"
                ? setDescriptionThumbs
                : setCommentThumbs;
            setThumbs((prev) => {
              const row = prev.find((thumb) => thumb.localId === options.localId);
              if (row?.revokeOnClear) URL.revokeObjectURL(row.previewUrl);
              return prev.filter((thumb) => thumb.localId !== options.localId);
            });
          }
          return;
        }
        if (options?.zone && options.localId) {
          const setThumbs =
            options.zone === "description"
              ? setDescriptionThumbs
              : setCommentThumbs;
          setThumbs((prev) => {
            const next = prev.map((thumb) => {
              if (thumb.localId !== options.localId) return thumb;
              if (thumb.revokeOnClear) URL.revokeObjectURL(thumb.previewUrl);
              return {
                localId: result.id,
                previewUrl: workFileImageHref(result.id),
                fileId: result.id,
                uploading: false,
                revokeOnClear: false,
              };
            });
            if (options.zone === "description") {
              queueMicrotask(() => persistDescription(next));
            }
            return next;
          });
        }
        onChanged();
      }
    );
  }

  function handlePaste(event: ClipboardEvent) {
    if (pending) return;
    const items = event.clipboardData?.items;
    if (!items?.length) return;
    const images: File[] = [];
    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      const blob = item.getAsFile();
      if (blob) images.push(blob);
    }
    if (images.length === 0) return;
    event.preventDefault();
    const zone = pasteZoneFromTarget(event.target);
    images.forEach((image, index) => {
      const named = new File([image], pasteFileName(image, index), {
        type: image.type || "image/png",
      });
      if (zone) {
        const localId = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(named);
        const thumb: InlinePasteThumb = {
          localId,
          previewUrl,
          fileId: null,
          uploading: true,
          revokeOnClear: true,
        };
        if (zone === "description") {
          setDescriptionThumbs((prev) => [...prev, thumb]);
        } else {
          setCommentThumbs((prev) => [...prev, thumb]);
        }
        uploadFile(named, { zone, localId, previewUrl });
        return;
      }
      uploadFile(named);
    });
  }

  const imageFiles = useMemo(
    () => issue.files.filter((file) => isImageMime(file.mimeType)),
    [issue.files]
  );
  const otherFiles = useMemo(
    () => issue.files.filter((file) => !isImageMime(file.mimeType)),
    [issue.files]
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPaste={handlePaste}
    >
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
            <TabsTrigger value="requirements" className="px-3 !px-3">
              Requirements
              {issue.requirements.length > 0
                ? ` ${issue.requirements.filter((row) => row.isDone).length}/${issue.requirements.length}`
                : ""}
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
              label="Priority"
              value={issue.priority ?? ""}
              disabled={pending}
              onValueChange={(value) => {
                const priority =
                  value === "" ? null : (value as WorkIssuePriority);
                onIssuePatch({ priority });
                run(() =>
                  updateWorkIssuePriorityAction(board.id, issue.id, priority)
                );
              }}
              options={[
                { value: "", label: "None" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
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
              <p className="text-sm text-text-primary">
                {issue.reporter?.name ?? "—"}
              </p>
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
              <label className="block" data-paste-zone="description">
                <span className="mb-0.5 block text-[13px] text-text-secondary">
                  Description
                </span>
                <AutosizeTextarea
                  className={textFieldClass}
                  value={description}
                  disabled={pending}
                  placeholder="Add description…"
                  onChange={(event) => setDescription(event.target.value)}
                  onBlur={saveDescription}
                />
                <WorkInlineImageThumbs
                  items={descriptionThumbs.map((thumb) => ({
                    key: thumb.localId,
                    src: thumb.previewUrl,
                    uploading: thumb.uploading,
                  }))}
                  onRemove={(key) => {
                    setDescriptionThumbs((prev) => {
                      const row = prev.find((thumb) => thumb.localId === key);
                      if (row?.revokeOnClear) {
                        URL.revokeObjectURL(row.previewUrl);
                      }
                      const next = prev.filter((thumb) => thumb.localId !== key);
                      queueMicrotask(() => persistDescription(next));
                      return next;
                    });
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[13px] text-text-secondary">
                  Current state
                </span>
                <AutosizeTextarea
                  className={textFieldClass}
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
                <AutosizeTextarea
                  className={textFieldClass}
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
          <TabsContent value="requirements" className="mt-5 space-y-8">
            <RequirementsChecklistSection
              title="Acceptance criteria"
              description="What must be true for this issue to be done."
              emptyLabel="No acceptance criteria yet."
              placeholder="Add a criterion…"
              items={issue.requirements}
              draft={requirementDraft}
              onDraftChange={setRequirementDraft}
              editingId={editingRequirementId}
              editingValue={editingRequirementValue}
              pending={pending}
              onEditingIdChange={setEditingRequirementId}
              onEditingValueChange={setEditingRequirementValue}
              onToggle={(requirement, isDone) => {
                onIssuePatch({
                  requirements: issue.requirements.map((row) =>
                    row.id === requirement.id ? { ...row, isDone } : row
                  ),
                });
                run(
                  () =>
                    updateWorkIssueRequirementDoneAction(
                      board.id,
                      issue.id,
                      requirement.id,
                      isDone
                    ),
                  { refresh: false }
                );
              }}
              onSaveBody={(requirement, body) => {
                onIssuePatch({
                  requirements: issue.requirements.map((row) =>
                    row.id === requirement.id ? { ...row, body } : row
                  ),
                });
                run(() =>
                  updateWorkIssueRequirementBodyAction(
                    board.id,
                    issue.id,
                    requirement.id,
                    body
                  )
                );
              }}
              onRemove={(requirement) => {
                onIssuePatch({
                  requirements: issue.requirements.filter(
                    (row) => row.id !== requirement.id
                  ),
                });
                run(
                  () =>
                    deleteWorkIssueRequirementAction(
                      board.id,
                      issue.id,
                      requirement.id
                    ),
                  { refresh: false }
                );
              }}
              onAdd={(body) => {
                setRequirementDraft("");
                run(() =>
                  addWorkIssueRequirementAction(
                    board.id,
                    issue.id,
                    body,
                    "acceptance"
                  )
                );
              }}
            />

            <RequirementsChecklistSection
              title="Definition of done"
              description="Shared quality bar for this issue (review, staging, docs…)."
              emptyLabel="No definition-of-done items yet."
              placeholder="Add a DoD item…"
              items={issue.definitionOfDone}
              draft={dodDraft}
              onDraftChange={setDodDraft}
              editingId={editingRequirementId}
              editingValue={editingRequirementValue}
              pending={pending}
              onEditingIdChange={setEditingRequirementId}
              onEditingValueChange={setEditingRequirementValue}
              onToggle={(requirement, isDone) => {
                onIssuePatch({
                  definitionOfDone: issue.definitionOfDone.map((row) =>
                    row.id === requirement.id ? { ...row, isDone } : row
                  ),
                });
                run(
                  () =>
                    updateWorkIssueRequirementDoneAction(
                      board.id,
                      issue.id,
                      requirement.id,
                      isDone
                    ),
                  { refresh: false }
                );
              }}
              onSaveBody={(requirement, body) => {
                onIssuePatch({
                  definitionOfDone: issue.definitionOfDone.map((row) =>
                    row.id === requirement.id ? { ...row, body } : row
                  ),
                });
                run(() =>
                  updateWorkIssueRequirementBodyAction(
                    board.id,
                    issue.id,
                    requirement.id,
                    body
                  )
                );
              }}
              onRemove={(requirement) => {
                onIssuePatch({
                  definitionOfDone: issue.definitionOfDone.filter(
                    (row) => row.id !== requirement.id
                  ),
                });
                run(
                  () =>
                    deleteWorkIssueRequirementAction(
                      board.id,
                      issue.id,
                      requirement.id
                    ),
                  { refresh: false }
                );
              }}
              onAdd={(body) => {
                setDodDraft("");
                run(() =>
                  addWorkIssueRequirementAction(board.id, issue.id, body, "dod")
                );
              }}
            />

            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  Out of scope
                </h3>
                <p className="text-sm text-text-secondary">
                  What this issue intentionally does not include.
                </p>
              </div>
              <AutosizeTextarea
                className={textFieldClass}
                value={outOfScope}
                disabled={pending}
                minRows={2}
                placeholder="Not in this issue…"
                onChange={(event) => setOutOfScope(event.target.value)}
                onBlur={() =>
                  saveField("out_of_scope", outOfScope, issue.outOfScope)
                }
              />
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  References
                </h3>
                <p className="text-sm text-text-secondary">
                  Links to Figma, Confluence, tickets, or other context.
                </p>
              </div>
              {issue.references.length === 0 ? (
                <p className="text-sm text-text-tertiary">No references yet.</p>
              ) : (
                <ul className="space-y-2">
                  {issue.references.map((reference) => (
                    <li
                      key={reference.id}
                      className="flex items-center gap-2 rounded-lg border border-border-subtle px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={reference.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-medium text-text-primary hover:underline"
                        >
                          {reference.label.trim() || referenceHostname(reference.url)}
                        </a>
                        <p className="truncate text-caption text-text-tertiary">
                          {reference.url}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        className="shrink-0 text-label-s text-text-secondary hover:text-danger"
                        aria-label="Remove reference"
                        onClick={() => {
                          onIssuePatch({
                            references: issue.references.filter(
                              (row) => row.id !== reference.id
                            ),
                          });
                          run(
                            () =>
                              deleteWorkIssueReferenceAction(
                                board.id,
                                issue.id,
                                reference.id
                              ),
                            { refresh: false }
                          );
                        }}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={(event) => {
                  event.preventDefault();
                  const url = referenceUrlDraft.trim();
                  if (!url) return;
                  const label = referenceLabelDraft.trim();
                  setReferenceUrlDraft("");
                  setReferenceLabelDraft("");
                  run(() =>
                    addWorkIssueReferenceAction(
                      board.id,
                      issue.id,
                      url,
                      label
                    )
                  );
                }}
              >
                <input
                  value={referenceUrlDraft}
                  disabled={pending}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal"
                  onChange={(event) => setReferenceUrlDraft(event.target.value)}
                />
                <input
                  value={referenceLabelDraft}
                  disabled={pending}
                  placeholder="Label (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-signal focus:outline-none focus:ring-1 focus:ring-brand-signal sm:max-w-[10rem]"
                  onChange={(event) =>
                    setReferenceLabelDraft(event.target.value)
                  }
                />
                <Button
                  type="submit"
                  disabled={pending || !referenceUrlDraft.trim()}
                >
                  Add
                </Button>
              </form>
            </div>
          </TabsContent>
          <TabsContent value="files" className="mt-5 space-y-4">
            <div className="space-y-1">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text-primary">
                  Upload a file
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,.zip"
                  disabled={pending}
                  className="text-sm text-text-secondary"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    uploadFile(file);
                  }}
                />
              </label>
              <p className="text-xs text-text-tertiary">
                Max 8 MB. Paste images from the clipboard anywhere in this
                issue.
              </p>
            </div>

            {issue.files.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No files yet. Paste a screenshot or upload a file.
              </p>
            ) : (
              <div className="space-y-4">
                {imageFiles.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-2">
                    {imageFiles.map((file) => (
                      <li
                        key={file.id}
                        className="group relative overflow-hidden rounded-lg border border-border-subtle bg-bg-muted"
                      >
                        <a
                          href={workFileHref(file.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                          title={file.fileName}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={workFileHref(file.id)}
                            alt={file.fileName}
                            className="aspect-[4/3] w-full object-cover"
                          />
                        </a>
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                          <a
                            href={workFileHref(file.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 truncate text-label-s text-text-secondary hover:text-text-primary hover:underline"
                          >
                            {file.fileName}
                          </a>
                          <button
                            type="button"
                            disabled={pending}
                            className="shrink-0 text-label-s text-text-secondary hover:text-danger"
                            onClick={() =>
                              run(() =>
                                deleteWorkIssueFileAction(
                                  board.id,
                                  issue.id,
                                  file.id
                                )
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {otherFiles.length > 0 ? (
                  <ul className="divide-y divide-border-subtle">
                    {otherFiles.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <a
                          href={workFileHref(file.id)}
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
                              deleteWorkIssueFileAction(
                                board.id,
                                issue.id,
                                file.id
                              )
                            )
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {uploadBarVisible ? (
        <div
          className="shrink-0 border-t border-border-subtle px-6 py-2"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-label-s text-text-secondary">
              {uploadingCount > 1
                ? `Uploading ${uploadingCount} images…`
                : "Uploading image…"}
            </span>
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-muted">
              <div className="h-full w-full animate-pulse rounded-full bg-interactive-primary" />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "details" ? (
      <form
        className="flex shrink-0 items-end gap-2 border-t border-border-subtle px-6 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          const text = encodeMentions(commentDraft.trim(), board.members);
          const body = joinWorkInlineImages(
            text,
            commentThumbs
              .map((thumb) => thumb.fileId)
              .filter((id): id is string => Boolean(id))
          );
          if (!body) return;
          if (commentThumbs.some((thumb) => thumb.uploading)) return;
          setCommentDraft("");
          setCommentThumbs((prev) => {
            clearThumbs(prev);
            return [];
          });
          run(() => addWorkIssueCommentAction(board.id, issue.id, body));
        }}
      >
        <InitialsAvatar
          name={board.currentUser.name}
          initials={board.currentUser.initials}
          size="xs"
        />
        <div className="min-w-0 flex-1" data-paste-zone="comment">
          <WorkCommentComposer
            people={board.members}
            value={commentDraft}
            disabled={pending}
            className={`${commentClass} min-h-[5.5rem] resize-none`}
            onChange={setCommentDraft}
          />
          <WorkInlineImageThumbs
            items={commentThumbs.map((thumb) => ({
              key: thumb.localId,
              src: thumb.previewUrl,
              uploading: thumb.uploading,
            }))}
            onRemove={(key) => {
              setCommentThumbs((prev) => {
                const row = prev.find((thumb) => thumb.localId === key);
                if (row?.revokeOnClear) {
                  URL.revokeObjectURL(row.previewUrl);
                }
                return prev.filter((thumb) => thumb.localId !== key);
              });
            }}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={
            pending ||
            commentThumbs.some((thumb) => thumb.uploading) ||
            (!commentDraft.trim() &&
              commentThumbs.every((thumb) => !thumb.fileId))
          }
        >
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

type CardAssignRole = "owner" | "assignee";

type CardAssignMenu =
  | { step: "role"; top: number; left: number }
  | { step: "person"; role: CardAssignRole; top: number; left: number };

export function WorkCardPeople({
  owner,
  assignees,
  people = [],
  disabled,
  onSetOwner,
  onAddAssignee,
}: {
  owner: WorkPerson | null;
  assignees: WorkPerson[];
  people?: WorkPerson[];
  disabled?: boolean;
  onSetOwner?: (person: WorkPerson) => void;
  onAddAssignee?: (person: WorkPerson) => void;
}) {
  const interactive = onSetOwner != null && onAddAssignee != null;
  const [menu, setMenu] = useState<CardAssignMenu | null>(null);
  const extras = assignees
    .filter((person) => person.id !== owner?.id)
    .slice(0, 3);

  const personChoices = useMemo(() => {
    if (!menu || menu.step !== "person") return [];
    if (menu.role === "owner") return people;
    const taken = new Set(assignees.map((person) => person.id));
    return people.filter((person) => !taken.has(person.id));
  }, [assignees, menu, people]);

  useEffect(() => {
    if (!menu) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-card-assign-people]")
      ) {
        return;
      }
      setMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menu]);

  if (!interactive && !owner && extras.length === 0) return null;

  return (
    <span
      className="relative flex shrink-0 items-center gap-1"
      data-card-assign-people
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="flex items-center -space-x-1.5">
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
      {interactive && people.length > 0 ? (
        <button
          type="button"
          disabled={disabled}
          data-card-assign-people
          aria-label="Add owner or assignee"
          aria-expanded={menu != null}
          aria-haspopup="menu"
          title="Add owner or assignee"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle text-text-tertiary hover:bg-bg-muted hover:text-text-primary disabled:opacity-50"
          onClick={(event) => {
            event.stopPropagation();
            if (menu) {
              setMenu(null);
              return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            const width = 168;
            setMenu({
              step: "role",
              top: rect.bottom + 4,
              left: Math.min(rect.left, window.innerWidth - width - 8),
            });
          }}
        >
          <Plus className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
      {menu
        ? createPortal(
            <div
              data-card-assign-people
              role="menu"
              aria-label={
                menu.step === "role"
                  ? "Choose role"
                  : menu.role === "owner"
                    ? "Choose owner"
                    : "Choose assignee"
              }
              className="fixed z-50 max-h-60 min-w-[10.5rem] overflow-y-auto rounded-lg border border-border-subtle bg-bg-default py-1 shadow-lg"
              style={{ top: menu.top, left: menu.left }}
            >
              {menu.step === "role" ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full px-2.5 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
                    onClick={() =>
                      setMenu({
                        step: "person",
                        role: "owner",
                        top: menu.top,
                        left: menu.left,
                      })
                    }
                  >
                    Owner
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full px-2.5 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
                    onClick={() =>
                      setMenu({
                        step: "person",
                        role: "assignee",
                        top: menu.top,
                        left: menu.left,
                      })
                    }
                  >
                    Assignee
                  </button>
                </>
              ) : personChoices.length === 0 ? (
                <p className="px-2.5 py-1.5 text-body-m text-text-tertiary">
                  No people available
                </p>
              ) : (
                personChoices.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-body-m text-text-primary hover:bg-bg-muted"
                    onClick={() => {
                      if (menu.role === "owner") onSetOwner?.(person);
                      else onAddAssignee?.(person);
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
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
