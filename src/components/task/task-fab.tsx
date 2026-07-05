"use client";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * 新增任務 FAB — 對齊 Mac createTaskFAB：60×60 玻璃圓（Material +
 * shadow fallback）、無邊框、浮在任務欄右下（外層負責定位）。
 */
export function TaskFab({ onClick }: { onClick: () => void }) {
  const t = useTranslations("task");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("createPlaceholder")}
      title={t("createPlaceholder")}
      className="pointer-events-auto flex items-center justify-center h-[60px] w-[60px] rounded-full bg-card/80 backdrop-blur-md shadow-lg text-foreground hover:bg-card transition-colors"
    >
      <Plus className="h-[22px] w-[22px]" />
    </button>
  );
}
