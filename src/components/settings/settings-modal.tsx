"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsContent } from "./settings-content";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const t = useTranslations("settings");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold">{t("title")}</DialogTitle>
        <SettingsContent />
      </DialogContent>
    </Dialog>
  );
}
