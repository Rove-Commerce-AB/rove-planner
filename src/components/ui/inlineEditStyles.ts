/**
 * Shared class names for inline-editable fields. Plain module (no "use client")
 * so they can be imported anywhere without affecting client boundaries.
 *
 * Layout-shift prevention: value row and status row use these constants so
 * display and edit states share the same outer box (min-height, padding, line-height).
 */

/** Min height of the value row (display trigger or input/select). Same for all detail inline edits. */
export const INLINE_EDIT_VALUE_ROW_MIN_H = "min-h-[2rem]";
/** Min height of the status row (saving/saved/error strip). Always reserved to avoid layout shift. */
export const INLINE_EDIT_STATUS_ROW_MIN_H = "min-h-[0.75rem]";

const INLINE_EDIT_BOX =
  `${INLINE_EDIT_VALUE_ROW_MIN_H} rounded-md border border-form px-2 py-1.5 text-sm leading-normal`;
const INLINE_EDIT_FOCUS =
  "focus:outline-none focus:border-brand-signal focus:ring-2 focus:ring-brand-signal/20 focus:ring-inset";

export const editInputClass =
  `min-w-0 flex-1 w-full ${INLINE_EDIT_BOX} bg-bg-default text-text-primary transition-colors placeholder:text-text-muted ${INLINE_EDIT_FOCUS}`;

export const editInputListClass =
  "min-w-0 flex-1 min-h-[2rem] rounded-md border border-form px-2 py-1 text-sm leading-normal bg-bg-default text-text-primary transition-colors placeholder:text-text-muted focus:outline-none focus:border-brand-signal focus:ring-2 focus:ring-brand-signal/20 focus:ring-inset";

/** For Select trigger in edit state: same box as input (min-height, padding, radius, border). */
export const editTriggerClass =
  `w-full min-w-0 ${INLINE_EDIT_VALUE_ROW_MIN_H} rounded-md border border-form px-1 py-1.5 text-sm leading-normal focus:border-brand-signal focus:ring-2 focus:ring-brand-signal/20 focus:ring-inset`;

export const inlineEditTriggerClass =
  `flex w-full min-w-0 cursor-pointer items-center gap-2 ${INLINE_EDIT_VALUE_ROW_MIN_H} rounded-md border border-transparent px-1 py-1.5 text-left text-sm font-semibold leading-normal text-text-primary transition-colors hover:bg-bg-muted/50 hover:border-form focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset`;

export const inlineEditTriggerListClass =
  "flex-1 min-h-[2rem] cursor-pointer rounded-md border border-transparent py-1 px-2 text-left text-sm font-medium leading-normal text-text-primary transition-colors hover:bg-bg-muted/50 hover:border-form focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset";

/** Same as inlineEditTriggerListClass but without own background hover – use when the list row already has hover:bg-bg-muted/50 (e.g. Settings Roles/Teams). */
export const inlineEditTriggerListClassRowHover =
  "flex-1 min-h-[2rem] cursor-pointer rounded-md border border-transparent py-1 px-2 text-left text-sm font-medium leading-normal text-text-primary transition-colors hover:border-form focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset";

/** Modal forms: discreet gray border in all states; focus shown by gray ring only (no orange). */
export const modalFocusClass =
  "focus:outline-none focus:border-form focus:ring-2 focus:ring-[var(--color-border-form)] focus:ring-inset";
const modalInputBase =
  "rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted disabled:opacity-50 " +
  modalFocusClass;
export const modalInputClass = `w-full ${modalInputBase}`;
export const modalSelectTriggerClass = `rounded-lg border border-form bg-bg-default text-sm ${modalFocusClass}`;
