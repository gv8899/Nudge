"use client";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export function TaskFab({ onClick }: { onClick: () => void }) {
  const t = useTranslations("task");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("createPlaceholder")}
      title={t("createPlaceholder")}
      className="fixed bottom-8 right-8 z-30 flex items-center justify-center h-12 w-12 rounded-full bg-card text-foreground border border-border shadow-md hover:bg-surface-hover transition-colors"
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}
