"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/** Shared modal shell. For form content use class "modal-form-discreet" and modal styles from inlineEditStyles (modalInputClass, modalSelectTriggerClass, etc.) for consistent borders and focus. */
type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  title: string;
  children: React.ReactNode;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  ...props
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg-default p-6 shadow-xl focus:outline-none"
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
          <DialogPrimitive.Title className="pr-10 text-lg font-semibold text-text-primary">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-sm border border-transparent p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100 focus:outline-none focus:border-form focus:ring-2 focus:ring-[var(--color-border-form)] focus:ring-inset"
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
