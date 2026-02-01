"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "./Button";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  onClose,
  onConfirm,
}: Props) {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg-default p-6 shadow-xl focus:outline-none"
          onEscapeKeyDown={onClose}
        >
          <AlertDialog.Title className="text-lg font-semibold text-text-primary">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-4 text-sm text-text-primary opacity-90">
            {message}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              variant={variant}
              onClick={async () => {
                await handleConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
