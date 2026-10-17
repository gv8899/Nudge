"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import useSWR, { mutate as globalMutate } from "swr";
import { ChevronLeft } from "lucide-react";
import { SFIcon } from "@/components/ui/sf-icon";
import { useSidebarCollapsed } from "@/components/sidebar/sidebar-layout";
import { fetcher } from "@/lib/fetcher";
import { DebouncedSaver } from "@/lib/debounced-saver";
import { TiptapEditor } from "@/components/task/tiptap-editor";
import { seedCardVersion, patchCardField, getCardVersion, isCardSaveInFlight } from "@/lib/card-version";
import { subscribeLiveSync } from "@/lib/live-sync";
import { decideRemoteChange, decideOnDataChange, cardContentOf, type CardContent } from "@/lib/live-sync-rules";
import { TagPicker } from "@/components/tags/tag-picker";
import { useTags } from "@/hooks/use-tags";
import { shouldPersistDescription } from "@/lib/strip-html";

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
  const sidebarCollapsed = useSidebarCollapsed();
  const t = useTranslations("cardDetail");
  const tCommon = useTranslations("common");
  const { data, error, isLoading, mutate } = useSWR<CardData>(
    `/api/tasks/${id}`,
    fetcher,
    // 即時同步（事件 + reconnected 補抓）已涵蓋這兩種情況；focus 重抓會在編輯器已 mount 時默默換掉 data。
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  // 標題 — 永遠可編輯的 input（對齊 Mac CardDetailView macHeader），不強制
  // focus、不做 click-to-edit 兩態。打字中（focused）時不要讓 data.title
  // 變化蓋掉草稿（同 task-detail-modal 的 focused-guard）。
  const [titleDraft, setTitleDraft] = useState("");
  const isTitleFocusedRef = useRef(false);
  // 409 衝突時 ++ 換掉編輯器 key 強制重 mount，載入 server 最新內文。
  const [reloadToken, setReloadToken] = useState(0);
  // 編輯器實際 mount 的內容（重抓後是否重 mount 的比對基準；不能用 SWR data，
  // data 可能被其他重抓更新而編輯器仍是舊內容）。
  const mountedContentRef = useRef<CardContent>({ title: "", description: "" });
  const mountedForIdRef = useRef<string | null>(null);
  const [cardTags, setCardTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const { tags: allTags } = useTags();

  useEffect(() => {
    if (isTitleFocusedRef.current) return;
    if (data?.title !== undefined) setTitleDraft(data.title);
  }, [data?.title]);

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
        mountedContentRef.current = cardContentOf(latest);
        setReloadToken((n) => n + 1);
        await mutate(latest, { revalidate: false });
        invalidateCardsCache();
        return;
      }
      // 自己存成功：編輯器顯示的就是剛存的內容。
      if (updates.title !== undefined) mountedContentRef.current.title = updates.title;
      if (updates.description !== undefined) mountedContentRef.current.description = updates.description;
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
        patchTaskRef.current({ description: shouldPersistDescription(html) ? html : "" });
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

  // 本機有未存 / 在途的修改（存檔在途：基準還沒推進，自己的回音不能當遠端變更）。
  // seed 與即時同步閘門共用同一個判斷。
  const isLocallyPending = useCallback(
    () =>
      descSaver.isPending() ||
      titleSaver.isPending() ||
      isTitleFocusedRef.current ||
      isCardSaveInFlight(id),
    [id, descSaver, titleSaver]
  );

  // data 變動（任何來源：即時同步重抓、warm cache 的 mount 重抓、tags / 存檔後的 mutate）
  // → 比對編輯器實際掛載的內容，再 seed 樂觀並行基準。
  // 不變式：基準只在編輯器顯示該版本時推進。TiptapEditor 不會重讀 content prop，
  // 所以內容不同就重 mount；本機編輯中則不 seed 也不重 mount，留舊基準讓 409 接手。
  // （自己存完 / 409 時已先更新 mountedContentRef，這裡會看到「相同」只 seed。）
  useEffect(() => {
    if (!data) return;
    const latest = cardContentOf(data);
    const first = mountedForIdRef.current !== id;
    if (first) {
      // 首次拿到這張卡的資料（含換 id）= 編輯器以這份 data mount。
      mountedForIdRef.current = id;
      mountedContentRef.current = latest;
    }
    const decision = decideOnDataChange({
      first,
      pending: isLocallyPending(),
      mounted: mountedContentRef.current,
      latest,
    });
    if (decision === "skip") return;
    if (decision === "remount-and-seed") {
      mountedContentRef.current = latest;
      setReloadToken((n) => n + 1);
    }
    seedCardVersion(id, data.updatedAt);
  }, [id, data, isLocallyPending]); // isLocallyPending 只隨 id 變（saver 穩定）

  // 即時同步：別處改了這張卡 → 純檢視時換最新；正在打字（saver pending）
  // 時不動，交給存檔的 409 路徑。reconnected → 無條件補抓一次（斷線期間可能漏事件）。
  useEffect(() => {
    // 只重抓：data 變動後由上面的 data effect 比對掛載內容 → 重 mount / 確認相同 → seed。
    // 重抓途中使用者若開始打字，effect 會看到 pending 而跳過（讓 pending 存檔勝出）。
    const refetchAndReload = () => {
      void mutate();
    };
    return subscribeLiveSync((m) => {
      const hasPending = isLocallyPending();
      if (m.type === "reconnected") {
        if (!hasPending) refetchAndReload();
        return;
      }
      const decision = decideRemoteChange({
        event: m.event,
        cardId: id,
        baseUpdatedAt: getCardVersion(id),
        hasPending,
      });
      if (decision === "list-only") { invalidateCardsCache(); return; }
      if (decision === "ignore") return;
      // apply：SWR 重抓 → data 變 → data effect 比對後重 mount（內容不同）並 seed 新基準。
      refetchAndReload();
      invalidateCardsCache();
    });
  }, [id, mutate, isLocallyPending]);

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
      {/* 全頁（md+）：返回 + 標籤 = 頂部 toolbar 帶左段兩顆玻璃 chip（對齊 Mac） */}
      {!embedded && (
        <div
          className="hidden md:flex items-center gap-2 fixed top-[14px] h-9 z-40 transition-[left] duration-300 ease-out"
          style={{ left: sidebarCollapsed ? 66 : 200 }}
        >
          <Link
            href="/cards"
            aria-label={t("backToCards")}
            title={t("backToCards")}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-foreground hover:bg-card transition-colors"
          >
            <SFIcon name="chevron-left" className="h-4 w-4" />
          </Link>
          <TagPicker
            selectedTags={cardTags}
            onTagsChange={handleTagsChange}
            variant="icon"
            triggerClassName="flex items-center justify-center h-9 w-9 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-foreground hover:bg-card transition-colors"
          />
        </div>
      )}
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

        {/* tags 入口（手機）— md+ 已移到頂部 toolbar 帶 */}
        {!embedded && (
          <span className="md:hidden">
            <TagPicker
              selectedTags={cardTags}
              onTagsChange={handleTagsChange}
              variant="icon"
            />
          </span>
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
          attachmentTaskId={id}
        />
      </div>
    </div>
  );
}
