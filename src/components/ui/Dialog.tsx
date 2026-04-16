"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/** Shared modal shell. For form content use class "modal-form-discreet" and modal styles from inlineEditStyles (modalInputClass, modalSelectTriggerClass, etc.) for consistent borders and focus. */
type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  overlayClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  closeClassName?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  overlayClassName,
  contentClassName,
  titleClassName,
  subtitleClassName,
  closeClassName,
  ...props
}: DialogProps) {
  const defaultOverlayClass =
    "fixed inset-0 z-50 bg-black/18 backdrop-blur-[1px]";
  const defaultContentClass =
    "fixed left-1/2 top-1/2 z-50 w-full max-w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-border-subtle bg-bg-default p-8 shadow-[0_14px_36px_rgba(0,0,0,0.12)] focus:outline-none";
  const defaultSubtitleClass =
    "pr-10 text-xs font-medium tracking-[0.14em] uppercase text-text-muted";
  const defaultTitleClass = `pr-10 leading-tight font-semibold text-text-primary ${
    subtitle ? "text-[44px]" : "text-lg"
  }`;
  const defaultCloseClass =
    "absolute right-4 top-4 rounded-sm border border-transparent p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100 focus:outline-none focus:border-form focus:ring-2 focus:ring-[var(--color-border-form)] focus:ring-inset";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={`${defaultOverlayClass} ${overlayClassName ?? ""}`.trim()} />
        <DialogPrimitive.Content
          className={`${defaultContentClass} ${contentClassName ?? ""}`.trim()}
          onPointerDownOutside={(e) => {
            const target = e.target;
            const el =
              target instanceof Element
                ? target
                : (target as { parentElement?: Element | null } | null)?.parentElement ?? null;
            if (el?.closest?.("[data-combobox-list]")) e.preventDefault();
            else onOpenChange?.(false);
          }}
          onEscapeKeyDown={() => onOpenChange?.(false)}
        >
          {subtitle ? (
            <p className={`${defaultSubtitleClass} ${subtitleClassName ?? ""}`.trim()}>
              {subtitle}
            </p>
          ) : null}
          <DialogPrimitive.Title className={`${defaultTitleClass} ${titleClassName ?? ""}`.trim()}>
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className={`${defaultCloseClass} ${closeClassName ?? ""}`.trim()}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
