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
  "box-border h-8 min-h-8 rounded-md border border-form px-2.5 py-0 text-sm font-medium leading-normal";
/** Inset ring only — never grow the box or shift neighboring labels. */
const INLINE_EDIT_FOCUS =
  "outline-none focus:outline-none focus-visible:outline-none focus:border-brand-signal focus:ring-2 focus:ring-inset focus:ring-brand-signal/20";

export const editInputClass =
  `min-w-0 flex-1 w-full ${INLINE_EDIT_BOX} bg-bg-default text-text-primary placeholder:text-text-muted ${INLINE_EDIT_FOCUS}`;

export const editInputListClass =
  `min-w-0 flex-1 ${INLINE_EDIT_BOX} bg-bg-default text-text-primary placeholder:text-text-muted ${INLINE_EDIT_FOCUS}`;

/** For Select trigger in edit state: paired with Select variant="inlineEdit" (outer h-8); no extra vertical padding so height matches InlineEditTrigger. */
export const editTriggerClass =
  `box-border h-8 w-full min-w-0 rounded-md border border-form bg-bg-default px-2.5 py-0 text-sm font-medium leading-normal text-text-primary ${INLINE_EDIT_FOCUS}`;

/** Always-on drawer Select: matches the boxed drawer value, including hover. */
export const drawerSelectTriggerClass =
  `box-border h-8 w-full min-w-0 rounded-md border border-form bg-bg-default px-2.5 py-0 text-sm font-medium leading-normal text-text-primary hover:bg-interactive-secondary ${INLINE_EDIT_FOCUS}`;

/** Display trigger: h-8 matches inline-edit Select trigger; py-0 avoids growing past that for single-line values. */
export const inlineEditTriggerClass =
  `flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 box-border rounded-md border border-transparent px-2.5 py-0 text-left text-sm font-semibold leading-normal text-text-primary transition-colors hover:bg-bg-muted/50 hover:border-form focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset`;

/** Drawer value box (Figma): always-visible border, sits in the right column. */
export const drawerEditTriggerClass =
  `flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 box-border rounded-md border border-form bg-bg-default px-2.5 py-0 text-left text-sm font-medium leading-normal text-text-primary transition-colors hover:bg-interactive-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset`;

export const inlineEditTriggerListClass =
  "flex-1 min-h-[2rem] cursor-pointer rounded-md border border-transparent py-1 px-2 text-left text-sm font-medium leading-normal text-text-primary transition-colors hover:bg-bg-muted/50 hover:border-form focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset";

/** Same as inlineEditTriggerListClass but without own background hover – use when the list row already has hover:bg-bg-muted/50 (e.g. Settings Roles/Teams). */
export const inlineEditTriggerListClassRowHover =
  "flex-1 min-h-[2rem] cursor-pointer rounded-md border border-transparent py-1 px-2 text-left text-sm font-medium leading-normal text-text-primary transition-colors hover:border-form focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-inset";

/** Modal forms: discreet gray border in all states; focus shown by a neutral ring. */
export const modalFocusClass =
  "focus:outline-none focus:border-form focus:ring-2 focus:ring-[var(--color-border-form)] focus:ring-inset";
const modalInputBase =
  "rounded-lg border border-form bg-bg-default px-3 py-2 text-sm text-text-primary placeholder-text-muted disabled:opacity-50 " +
  modalFocusClass;
export const modalInputClass = `w-full ${modalInputBase}`;
export const modalSelectTriggerClass = `rounded-lg border border-form bg-bg-default text-sm ${modalFocusClass}`;
