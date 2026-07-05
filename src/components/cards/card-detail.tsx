"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import useSWR, { mutate as globalMutate } from "swr";
import { ChevronLeft } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { DebouncedSaver } from "@/lib/debounced-saver";
import { TiptapEditor } from "@/components/task/tiptap-editor";
import { seedCardVersion, patchCardField } from "@/lib/card-version";
import { TagPicker } from "@/components/tags/tag-picker";
import { useTags } from "@/hooks/use-tags";

interface CardDetailProps {
  id: string;
  embedded?: boolean;
  onBack?: () => void;
}

interface CardData {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id: string; name: string; color: string }>;
}

// 失效 cards 列表的 SWR cache
function invalidateCardsCache() {
  globalMutate(
    (key) => typeof key === "string" && key.startsWith("/api/cards"),
    undefined,
    { revalidate: true }
  );
}

export function CardDetail({ id, embedded = false, onBack }: CardDetailProps) {
  const t = useTranslations("cardDetail");
  const tCommon = useTranslations("common");
  const { data, error, isLoading, mutate } = useSWR<CardData>(
    `/api/tasks/${id}`,
    fetcher
  );

  // 標題 — 永遠可編輯的 input（對齊 Mac CardDetailView macHeader），不強制
  // focus、不做 click-to-edit 兩態。打字中（focused）時不要讓 data.title
  // 變化蓋掉草稿（同 task-detail-modal 的 focused-guard）。
  const [titleDraft, setTitleDraft] = useState("");
  const isTitleFocusedRef = useRef(false);
  // 409 衝突時 ++ 換掉編輯器 key 強制重 mount，載入 server 最新內文。
  const [reloadToken, setReloadToken] = useState(0);
  const [cardTags, setCardTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const { tags: allTags } = useTags();

  useEffect(() => {
    if (isTitleFocusedRef.current) return;
    if (data?.title !== undefined) setTitleDraft(data.title);
  }, [data?.title]);

  // seed 樂觀並行基準：server 回的 updatedAt = 目前畫面內容所基於的版本。
  useEffect(() => {
    if (data?.updatedAt) seedCardVersion(id, data.updatedAt);
  }, [id, data?.updatedAt]);

  useEffect(() => {
    if (data?.tags) setCardTags(data.tags);
  }, [data]);

  // PATCH /api/tasks/[id]（帶 baseUpdatedAt 樂觀並行；409 → 靜默改用 server 最新）
  const patchTask = useCallback(
    async (updates: { title?: string; description?: string }) => {
      const result = await patchCardField(id, updates);
      if (result.status === "conflict") {
        // 別台先存、這次被擋 → 採用 server 最新（方案二 silent use-latest），
        // 丟棄本機這次衝突的編輯，重 mount 編輯器載入最新內文。
        const latest = result.latest as unknown as CardData;
        setTitleDraft(latest.title);
        await mutate(latest, { revalidate: false });
        setReloadToken((n) => n + 1);
        invalidateCardsCache();
        return;
      }
      mutate();
      invalidateCardsCache();
    },
    [id, mutate]
  );

  const patchTaskRef = useRef(patchTask);
  useEffect(() => {
    patchTaskRef.current = patchTask;
  });
  const [descSaver] = useState(
    // eslint-disable-next-line react-hooks/refs -- ref 只在 callback 內讀取（callback 從不在 render 時執行），非 render 期讀 ref
    () =>
      new DebouncedSaver<string>((html) => {
        const isEmpty =
          !html ||
          html === "<p></p>" ||
          html.replace(/<[^>]*>/g, "").trim() === "";
        patchTaskRef.current({ description: isEmpty ? "" : html });
      }, 800)
  );
  useEffect(() => () => descSaver.flush(), [descSaver]);

  // 標題打字即 debounce 存（對齊 Mac CardDetailView + task-detail-modal 的
  // Batch 2 pattern），blur/Enter 仍立即 flush。
  const [titleSaver] = useState(
    // eslint-disable-next-line react-hooks/refs -- ref 只在 callback 內讀取（callback 從不在 render 時執行），非 render 期讀 ref
    () =>
      new DebouncedSaver<string>((v) => {
        const trimmed = v.trim();
        if (trimmed) patchTaskRef.current({ title: trimmed });
      }, 500)
  );
  useEffect(() => () => titleSaver.flush(), [titleSaver]);

  const handleTagsChange = async (tagIds: string[]) => {
    // 樂觀更新：立即顯示 tag badge
    const newTags = tagIds
      .map((tid) => allTags.find((t) => t.id === tid))
      .filter(Boolean) as Array<{ id: string; name: string; color: string }>;
    setCardTags(newTags);

    await fetch(`/api/tasks/${id}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds }),
    });
    mutate();
    invalidateCardsCache();
  };

  const handleDescChange = useCallback(
    (html: string) => descSaver.schedule(html),
    [descSaver]
  );

  const containerClass = embedded
    ? "px-4 md:px-6 py-6"
    : "mx-auto max-w-3xl px-4 md:px-6 py-8";

  const titleClass = embedded
    ? "min-w-0 flex-1 text-card-detail-title text-foreground tracking-tight"
    : "min-w-0 flex-1 text-card-detail-title text-foreground tracking-tight";

  const descMinHeight = embedded ? "min-h-[40vh]" : "min-h-[60vh]";

  if (isLoading) {
    return (
      <div className={containerClass}>
        <p className="text-sm text-text-dim">{tCommon("loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={containerClass}>
        {embedded ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-4"
            aria-label={t("backToCards")}
            title={t("backToCards")}
          >
            <ChevronLeft className="h-5 w-5 text-primary" /> {t("backToCards")}
          </button>
        ) : (
          <Link
            href="/cards"
            className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-5 w-5 text-primary" /> {t("backToCards")}
          </Link>
        )}
        <p className="text-sm text-destructive">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <header className="flex items-center gap-2 mb-6">
        {/* 返回按鈕：只在 embedded（右側 pane）顯示；全頁靠左側 nav 回卡片列表，不需返回鈕 */}
        {embedded && (
          <button
            type="button"
            onClick={onBack}
            title={t("backToCards")}
            aria-label={t("backToCards")}
            className="shrink-0 text-primary hover:text-primary/70 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* 標題 — 永遠可編輯的 input（對齊 Mac），不強制 focus、無空標題自動進編輯 */}
        <input
          value={titleDraft}
          onChange={(e) => {
            setTitleDraft(e.target.value);
            titleSaver.schedule(e.target.value);
          }}
          onFocus={() => {
            isTitleFocusedRef.current = true;
          }}
          onBlur={() => {
            isTitleFocusedRef.current = false;
            titleSaver.flush();
            if (!titleDraft.trim()) setTitleDraft(data.title);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              titleSaver.flush();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder={t("untitled")}
          aria-label={t("editTitleAria")}
          className={`${titleClass} bg-transparent rounded outline-none border-b-2 border-transparent focus:border-primary transition-colors placeholder:text-text-faint placeholder:font-normal`}
        />

        {/* tags 入口 — 全頁對齊 Mac toolbar 鈕，開批次儲存的 TagPicker dialog；embedded（右側 pane）維持無 tags 入口 */}
        {!embedded && (
          <TagPicker
            selectedTags={cardTags}
            onTagsChange={handleTagsChange}
            variant="icon"
          />
        )}
      </header>

      {/* 描述（可編輯 TipTap） */}
      <div className={descMinHeight}>
        <TiptapEditor
          key={`${id}-${reloadToken}`}
          content={data.description || ""}
          onChange={handleDescChange}
          placeholder={t("editorPlaceholder")}
          editable={true}
        />
      </div>
    </div>
  );
}
