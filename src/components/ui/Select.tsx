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
  className?: string;
  /** Extra classes for the trigger (e.g. h-10 for consistent height) */
  triggerClassName?: string;
  /** Extra classes for the dropdown viewport (e.g. max-h-60 overflow-y-auto for scroll) */
  viewportClassName?: string;
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
  className = "",
  triggerClassName = "",
  viewportClassName = "",
}: Props) {
  const EMPTY = "__empty__";
  const hasEmptyOption = options.some((o) => o.value === "");
  const rootValue =
    value === "" && !hasEmptyOption
      ? undefined
      : value === ""
        ? EMPTY
        : value;

  const triggerSize = size === "sm" ? "py-1.5 px-3 text-sm" : "py-2 px-3";

  return (
    <div className={className}>
      {label && (
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
          className={`inline-flex h-auto w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-bg-default text-left text-text-primary transition-colors placeholder:text-text-muted focus:border-brand-signal focus:outline-none focus:ring-2 focus:ring-brand-signal focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-text-muted ${triggerSize} ${triggerClassName}`.trim()}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-[100] overflow-hidden rounded-lg border border-border bg-bg-default shadow-lg"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport
              className={`p-1 ${viewportClassName}`.trim()}
            >
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value === "" ? EMPTY : opt.value}
                  value={opt.value === "" ? EMPTY : opt.value}
                  className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-text-primary outline-none data-[highlighted]:bg-bg-muted data-[state=checked]:bg-brand-lilac/30 data-[state=checked]:text-text-primary data-[highlighted]:data-[state=checked]:bg-brand-lilac/40"
                >
                  <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
