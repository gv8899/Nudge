"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  isLoading?: boolean;
  /** Confirm button color — destructive (red) or primary (brand). Default destructive. */
  destructive?: boolean;
}

/**
 * Shared confirmation modal — DialogTitle + DialogDescription + 取消/確認
 * footer, same pattern used across the round-4 dialog conversions (see
 * move-task-popover.tsx). Reused for logout / clean-untitled / delete
 * account / calendar disconnect / tag delete so every "are you sure?"
 * flow in the app looks and behaves the same way.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isLoading = false,
  destructive = true,
}: ConfirmDialogProps) {
  const tCommon = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-md px-4 py-1.5 text-sm text-primary-foreground focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${
              destructive
                ? "bg-destructive focus-visible:ring-destructive/40"
                : "bg-primary hover:opacity-90 focus-visible:ring-primary/40"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
