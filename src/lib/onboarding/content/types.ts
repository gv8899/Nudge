// Onboarding 範例內容的形狀（locale-neutral）。每個 locale 一份實作
// （zh-TW / en / ja），結構與 key 必須一致 —— content-parity 測試會擋差異。
//
// 這些是「資料」，不是 UI 字串：seed 進新帳號後就是使用者的真實任務/卡片，
// 因此不走 next-intl 訊息管線，而是各 locale 一個 TS 模組。
//
// `key` 是穩定識別碼：① 前端 inline 提示用它錨定特定範例項目；② parity 測試
// 用它比對三語結構一致。key 不入庫、也不顯示給使用者。

export type OnboardingTag = {
  key: string;
  name: string;
  /** design token 名（chart-1..5），對齊 tags.color 預設。 */
  color: string;
};

export type OnboardingTask = {
  key: string;
  title: string;
  /** 指派到今天的位移天數（0=今天、負值=逾期）。 */
  dayOffset: number;
  /** 是否已完成（done 狀態 + assignment.isCompleted）。 */
  done?: boolean;
  /** 重複規則 preset。 */
  recurrence?: "weekly_fri" | "weekdays";
  /** per-task 提醒時刻 "HH:MM"（僅設在有 recurrence 的教學任務上）。 */
  remindAtTimeOfDay?: string;
};

export type OnboardingCard = {
  key: string;
  title: string;
  /** rich-text HTML（= tasks.description，非空即成為「卡片」）。 */
  html: string;
  /** 關聯的標籤 key（對應 OnboardingTag.key）。 */
  tagKey?: string;
  /** 建立時間相對今天的位移（讓卡片有時間層次）。 */
  createdOffset: number;
};

export type OnboardingNote = {
  key: string;
  /** 日誌掛在哪天（相對今天）。 */
  dayOffset: number;
  /** 段落（寫入時以 "\n\n" join）。 */
  lines: string[];
};

export type OnboardingContent = {
  tags: OnboardingTag[];
  tasks: OnboardingTask[];
  cards: OnboardingCard[];
  notes: OnboardingNote[];
};
