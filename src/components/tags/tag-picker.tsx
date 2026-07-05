"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X, Check } from "lucide-react";
import { SFIcon } from "@/components/ui/sf-icon";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTags } from "@/hooks/use-tags";
import { TagBadge } from "./tag-badge";

interface TagPickerProps {
  selectedTags: Array<{ id: string; name: string; color: string }>;
  onTagsChange: (tagIds: string[]) => void;
  /**
   * "badges"（預設）= 選中 tag 徽章列 + 文字/圖示 trigger（task modal 用）。
   * "icon" = 純圖示鈕、不顯示徽章列（cards 全頁 header 用，對齊 Mac 的
   * toolbar tag 鈕 → TagPickerSheet，全頁本身不常駐 badge 列）。
   */
  variant?: "badges" | "icon";
  /** icon variant 的 trigger 樣式覆寫（如頂部 toolbar 玻璃 chip）。 */
  triggerClassName?: string;
}

/**
 * 對齊 Mac `TagPickerSheet`：批次儲存模型 —— 開啟時把目前選中的 tag 存成
 * 本地 draft，切換 tag 只改 draft，按「儲存」才一次 commit（呼叫
 * onTagsChange）；X / Escape / 點 backdrop 關閉都直接丟棄 draft（不呼叫
 * onTagsChange，下次開啟重新從 selectedTags 播種）。
 */
export function TagPicker({ selectedTags, onTagsChange, variant = "badges", triggerClassName }: TagPickerProps) {
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const { tags: allTags, mutate: mutateTags } = useTags();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());

  // 每次開啟重新從目前選中播種 draft — 對齊 Mac：關閉/取消不影響已存的選取。
  useEffect(() => {
    if (open) {
      setDraftIds(new Set(selectedTags.map((tag) => tag.id)));
      setSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在 open 變 true 那刻播種，selectedTags 變動不該重播種（會蓋掉使用者正在調整的 draft）
  }, [open]);

  const trimmedSearch = search.trim();
  const filtered = allTags.filter((tag) =>
    tag.name.toLowerCase().includes(trimmedSearch.toLowerCase())
  );
  const exactMatch = allTags.some(
    (tag) => tag.name.toLowerCase() === trimmedSearch.toLowerCase()
  );

  const toggleDraft = (tagId: string) => {
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const createTag = async (name: string) => {
    if (!name) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const tag = await res.json();
    await mutateTags();
    setDraftIds((prev) => new Set(prev).add(tag.id));
    setSearch("");
  };

  const handleSave = () => {
    onTagsChange([...draftIds]);
    setOpen(false);
  };

  // 觸發鈕上直接移除 badge —— 不經過批次 draft，立即 commit（跟開 sheet 調整是兩種互動）。
  const removeSelected = (tagId: string) => {
    onTagsChange(selectedTags.filter((tag) => tag.id !== tagId).map((tag) => tag.id));
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("addTag")}
          title={t("addTag")}
          className={triggerClassName ?? "shrink-0 text-text-dim hover:text-foreground transition-colors p-2 rounded-md hover:bg-border"}
        >
          <SFIcon name="tag" className="h-4 w-4" />
        </button>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedTags.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} onRemove={() => removeSelected(tag.id)} />
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted cursor-pointer"
            aria-label={t("addTag")}
          >
            <SFIcon name="tag" className="h-3.5 w-3.5" />
            <span>{selectedTags.length === 0 ? t("addTagShort") : "+"}</span>
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[560px] flex flex-col">
          <DialogTitle className="text-column-detail-title font-bold">{t("addTag")}</DialogTitle>

          <div className="-mx-4 flex flex-1 flex-col min-h-0 border-t border-border">
            <div className="relative flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <Search className="h-3.5 w-3.5 text-text-dim shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchOrCreate")}
                className="w-full pr-5 text-field bg-transparent outline-none placeholder:text-text-faint text-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-4 text-text-faint hover:text-text-dim transition-colors"
                  aria-label={tCommon("clear")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleDraft(tag.id)}
                  className="flex items-center gap-2 w-full min-h-11 text-left px-4 py-2 border-b border-border last:border-b-0 hover:bg-muted transition-colors"
                >
                  <span className="flex-1 truncate text-row-title text-foreground">{tag.name}</span>
                  {draftIds.has(tag.id) && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
              {trimmedSearch && !exactMatch && (
                <button
                  type="button"
                  onClick={() => createTag(trimmedSearch)}
                  className="flex items-center gap-2 w-full min-h-11 text-left px-4 py-2 text-row-title text-primary hover:bg-muted transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  {t("createNamed", { name: trimmedSearch })}
                </button>
              )}
            </div>
          </div>

          <div className="-mx-4 -mb-4 flex justify-end px-4 py-3 border-t border-border">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-primary px-3.5 py-1.5 text-inline-button text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {tCommon("save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
