"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  title: string;
  titleId?: string;
  children: React.ReactNode;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  titleId,
  children,
  ...props
}: DialogProps) {
  const id = titleId ?? "dialog-title";
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg-default p-6 shadow-xl focus:outline-none"
          onPointerDownOutside={() => onOpenChange?.(false)}
          onEscapeKeyDown={() => onOpenChange?.(false)}
          aria-labelledby={id}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title
            id={id}
            className="pr-10 text-lg font-semibold text-text-primary"
          >
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-sm p-1 text-text-primary opacity-60 hover:bg-bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-signal"
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
