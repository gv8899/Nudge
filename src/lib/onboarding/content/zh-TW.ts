// 繁體中文範例內容 —— first-run onboarding 教學素材。受眾：辦公室上班族。
// 重點示範：① 今天的任務清單（含重複+提醒）② 沒做完的任務會自動滾到今天
// （overdue / rollover）③ 卡片（會議記錄 / 知識 / 確認清單）。
// en / ja 為此檔的翻譯，結構須一致（content-parity 測試會擋差異）。

import type { OnboardingContent } from "./types";

export const zhTW: OnboardingContent = {
  tags: [
    { key: "meeting-notes", name: "會議記錄", color: "chart-1" },
    { key: "knowledge", name: "知識", color: "chart-2" },
    { key: "checklist", name: "確認清單", color: "chart-3" },
  ],
  tasks: [
    // 今天
    { key: "inbox-cleared", title: "整理早晨收件匣", dayOffset: 0, done: true },
    { key: "reply-client", title: "回覆客戶信件", dayOffset: 0 },
    { key: "weekly-sync-prep", title: "準備週會簡報", dayOffset: 0 },
    {
      key: "weekly-report",
      title: "寫週報",
      dayOffset: 0,
      recurrence: "weekly_fri",
      remindAtTimeOfDay: "17:00",
    },
    { key: "standup", title: "晨間站會", dayOffset: 0, recurrence: "weekdays" },
    // 前幾天沒做完 → 自動滾到今天的逾期（示範 rollover）
    { key: "expense-report", title: "送出上月報帳", dayOffset: -2 },
    { key: "vendor-followup", title: "追蹤供應商報價", dayOffset: -1 },
  ],
  cards: [
    {
      key: "nudge-guide",
      title: "Nudge 使用說明",
      tagKey: "knowledge",
      createdOffset: 0, // 最新 → 卡片列表最上方
      html: `<h2>Nudge 快速上手</h2>
<p>把每天要做的事丟進來，完成就打勾。<strong>沒做完的，隔天會自動出現在「今天」</strong>，不會不見、也不用手動搬。</p>
<h3>幾個好習慣</h3>
<ul>
<li>早上先看「今天」，把最重要的三件排在最前面</li>
<li>臨時想到的事，直接記成卡片，之後再整理</li>
<li>重複性工作設成每週 / 每日重複，交給提醒</li>
</ul>
<blockquote><p>先求每天清空，再求做得漂亮。</p></blockquote>`,
    },
    {
      key: "product-meeting",
      title: "產品開發會議記錄",
      tagKey: "meeting-notes",
      createdOffset: -1,
      html: `<h2>產品開發週會</h2>
<p><strong>時間：</strong>週一 10:00　<strong>與會：</strong>PM、設計、工程</p>
<h3>結論</h3>
<ul>
<li>下個版本聚焦「新人上手」流程，其他需求延後</li>
<li>設計本週給出兩版原型，週四評審</li>
<li>工程先把 API 契約定下來，避免返工</li>
</ul>
<h3>待辦</h3>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><div><p>PM：整理需求優先序（本週三前）</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>設計：原型 A / B（週四評審）</p></div></li>
</ul>`,
    },
    {
      key: "travel-checklist",
      title: "出國確認清單",
      tagKey: "checklist",
      createdOffset: -2,
      html: `<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><div><p>護照效期 6 個月以上</p></div></li>
<li data-type="taskItem" data-checked="true"><div><p>機票與登機證明</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>當地網路 / 漫遊</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>轉接頭與行動電源</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>住宿與交通訂單截圖</p></div></li>
</ul>`,
    },
  ],
  notes: [],
};
