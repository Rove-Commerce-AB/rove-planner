"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Loader2 } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  id?: string;
  disabled?: boolean;
  /** Compact size for inline/filter use */
  size?: "sm" | "md";
  /** Filter variant: small, discrete, pill-style for toolbar filters. Modal: discreet gray border, focus ring only. InlineEdit = detail-page inline selects; omits default padding/rounding so triggerClassName matches InlineEditTrigger height (no panel jump). */
  variant?: "default" | "filter" | "modal" | "inlineEdit";
  className?: string;
  /** Extra classes for the trigger (e.g. h-10 for consistent height) */
  triggerClassName?: string;
  /** Extra classes for the dropdown viewport (e.g. max-h-60 overflow-y-auto for scroll) */
  viewportClassName?: string;
  /** Called when the trigger loses focus (e.g. click outside) */
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  /** Show a small spinner on the trigger (e.g. while options are loading) */
  isLoading?: boolean;
};

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  label,
  error,
  id,
  disabled,
  size = "md",
  variant = "default",
  className = "",
  triggerClassName = "",
  viewportClassName = "",
  onBlur,
  isLoading = false,
}: Props) {
  const EMPTY = "__empty__";
  const hasEmptyOption = options.some((o) => o.value === "");
  const rootValue =
    value === "" && !hasEmptyOption
      ? undefined
      : value === ""
        ? EMPTY
        : value;

  const isFilter = variant === "filter";
  const isModal = variant === "modal";
  const isInlineEdit = variant === "inlineEdit";
  const triggerSize = isInlineEdit
    ? ""
    : isFilter
      ? "py-1.5 px-3 text-xs"
      : size === "sm"
        ? "py-1.5 px-3 text-sm"
        : "py-2 px-3 text-sm";
  const triggerShape = isInlineEdit
    ? ""
    : isFilter
    ? "rounded-lg border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] placeholder:opacity-70 focus:border-[var(--color-border-default)] focus:ring-1 focus:ring-[var(--color-border-default)]"
    : isModal
      ? "rounded-lg border border-form bg-bg-default text-text-primary focus:border-[var(--color-border-default)] focus:ring-1 focus:ring-[var(--color-border-default)]"
      : "rounded-lg border border-form bg-bg-default text-text-primary focus:border-[var(--color-border-default)] focus:ring-1 focus:ring-[var(--color-border-default)]";
  const contentBorderClass = isFilter
    ? "border-[var(--color-border-subtle)]"
    : "border-form";
  /** Match InlineEditFieldContainer value row: fixed h-8 so open state matches display trigger (avoids stacking extra py from default select). */
  const inlineEditTriggerBase =
    "group inline-flex h-8 w-full min-w-0 box-border shrink-0 items-center justify-between gap-1.5 overflow-hidden text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-text-muted data-[state=open]:rounded-b-none data-[state=open]:border-[var(--color-border-default)]";

  return (
    <div className={className}>
      {label && !isFilter && (
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}
      <SelectPrimitive.Root
        value={rootValue}
        onValueChange={(v) =>
          onValueChange(v === EMPTY || v === undefined ? "" : v)
        }
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={id}
          onBlur={onBlur}
          aria-busy={isLoading}
          aria-invalid={Boolean(error)}
          aria-describedby={error && id ? `${id}-error` : undefined}
          className={
            isInlineEdit
              ? `${inlineEditTriggerBase} ${triggerClassName}`.trim()
              : `group inline-flex h-auto w-full min-w-0 items-center justify-between gap-1.5 overflow-hidden text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-text-muted data-[state=open]:rounded-b-none data-[state=open]:border-[var(--color-border-default)] ${triggerSize} ${triggerShape} ${triggerClassName}`.trim()
          }
        >
          <span className="min-w-0 shrink truncate">
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
          <SelectPrimitive.Icon asChild>
            {isLoading ? (
              <Loader2
                className={
                  isFilter
                    ? "h-3.5 w-3.5 shrink-0 animate-spin text-text-muted"
                    : isInlineEdit
                      ? "h-3.5 w-3.5 shrink-0 animate-spin text-text-muted"
                      : "h-4 w-4 shrink-0 animate-spin text-text-muted"
                }
                aria-hidden
              />
            ) : (
              <ChevronDown
                className={
                  isFilter
                    ? "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180"
                    : isInlineEdit
                      ? "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180"
                      : "h-4 w-4 shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180"
                }
              />
            )}
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={`ds-dropdown-content ds-dropdown-joined z-[100] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-b-xl rounded-t-none border border-t-0 bg-bg-default shadow-none ${contentBorderClass}`}
            position="popper"
            side="bottom"
            sideOffset={0}
            align="start"
          >
            <SelectPrimitive.Viewport
              className={`max-h-60 overflow-y-auto px-1 pb-1 pt-2 ${viewportClassName}`.trim()}
            >
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value === "" ? EMPTY : opt.value}
                  value={opt.value === "" ? EMPTY : opt.value}
                  className={`relative flex cursor-pointer select-none items-center rounded-lg px-3 ${isFilter ? "py-1.5 text-xs" : "py-2 text-sm"} text-text-primary outline-none transition-colors data-[highlighted]:bg-brand-blue/20 data-[state=checked]:bg-brand-blue/30 data-[state=checked]:font-medium data-[state=checked]:text-text-primary data-[highlighted]:data-[state=checked]:bg-brand-blue/35`}
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && (
        <p id={id ? `${id}-error` : undefined} className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
