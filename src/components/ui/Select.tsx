"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";

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
  /** Filter variant: small, discrete, pill-style for toolbar filters. Modal: discreet gray border, focus ring only. */
  variant?: "default" | "filter" | "modal";
  className?: string;
  /** Extra classes for the trigger (e.g. h-10 for consistent height) */
  triggerClassName?: string;
  /** Extra classes for the dropdown viewport (e.g. max-h-60 overflow-y-auto for scroll) */
  viewportClassName?: string;
  /** Called when the trigger loses focus (e.g. click outside) */
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
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
  const triggerSize =
    isFilter
      ? "py-1 px-2.5 text-xs"
      : size === "sm"
        ? "py-1.5 px-3 text-sm"
        : "py-2 px-3 text-sm";
  const triggerShape = isFilter
    ? "rounded-[14px] border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] placeholder:opacity-70 focus:border-[var(--color-border-form)] focus:ring-1 focus:ring-[var(--color-border-form)]"
    : isModal
      ? "rounded-lg border border-form bg-bg-default text-text-primary focus:border-form focus:ring-2 focus:ring-[var(--color-border-form)] focus:ring-inset"
      : "rounded-lg border border-form bg-bg-default text-text-primary focus:border-brand-signal focus:ring-2 focus:ring-brand-signal/20 focus:ring-inset";

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
          aria-invalid={Boolean(error)}
          aria-describedby={error && id ? `${id}-error` : undefined}
          className={`inline-flex h-auto w-full min-w-0 items-center justify-between gap-1.5 overflow-hidden text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-text-muted ${triggerSize} ${triggerShape} ${triggerClassName}`.trim()}
        >
          <span className="min-w-0 shrink truncate">
            <SelectPrimitive.Value placeholder={placeholder} />
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className={isFilter ? "h-3.5 w-3.5 shrink-0 opacity-70" : "h-4 w-4 shrink-0 opacity-60"} />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-[100] overflow-hidden rounded-lg border border-form bg-bg-default shadow-lg"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport
              className={`max-h-60 overflow-y-auto p-1 ${viewportClassName}`.trim()}
            >
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value === "" ? EMPTY : opt.value}
                  value={opt.value === "" ? EMPTY : opt.value}
                  className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-1.5 text-sm text-text-primary outline-none data-[highlighted]:bg-bg-muted data-[state=checked]:bg-brand-lilac/30 data-[state=checked]:text-text-primary data-[highlighted]:data-[state=checked]:bg-brand-lilac/40"
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
