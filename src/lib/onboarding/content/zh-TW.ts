// 繁體中文範例內容 —— 從 scripts/seed-landing-demo.mjs 的行銷故事線搬過來，
// 作為 first-run onboarding 的教學素材。en / ja 為此檔的翻譯，結構須一致。

import type { OnboardingContent } from "./types";

export const zhTW: OnboardingContent = {
  tags: [
    { key: "work", name: "工作", color: "chart-1" },
    { key: "study", name: "讀書", color: "chart-2" },
    { key: "exercise", name: "運動", color: "chart-3" },
    { key: "life", name: "生活", color: "chart-4" },
  ],
  tasks: [
    { key: "morning-exercise", title: "早晨運動", dayOffset: 0, done: true },
    {
      key: "weekly-report",
      title: "寫週報",
      dayOffset: 0,
      recurrence: "weekly_fri",
      remindAtTimeOfDay: "17:00",
    },
    { key: "prep-slides", title: "準備簡報", dayOffset: 0 },
    { key: "read-chapter", title: "閱讀 1 章", dayOffset: 0 },
    { key: "standup", title: "晨間站會", dayOffset: 0, recurrence: "weekdays" },
    // 逾期（前幾天的）
    { key: "pay-bills", title: "繳水電費", dayOffset: -5 },
    { key: "reply-client", title: "回覆客戶 Email", dayOffset: -3 },
  ],
  cards: [
    {
      key: "okr",
      title: "Q2 團隊 OKR 討論",
      tagKey: "work",
      createdOffset: -1,
      html: `<h2>下季方向</h2>
<p>今天會議意外談出了下季的方向。重點不是開多少會，是有沒有留下<strong>可以行動的結論</strong>。</p>
<h3>三個 Key Result</h3>
<ul>
<li>新用戶啟用率從 32% 提升到 45%</li>
<li>核心流程的 P50 延遲降到 200ms 以下</li>
<li>每週固定出一篇產品紀錄</li>
</ul>
<blockquote><p>與其追蹤一堆指標，不如把一個指標做到位。</p></blockquote>`,
    },
    {
      key: "running-notes",
      title: "跑步筆記：第一個月的感想",
      tagKey: "exercise",
      createdOffset: -3,
      html: `<p>剛起步時膝蓋會痠，配速也抓不準。三週後身體逐漸適應，從 5K 變成可以跑 8K 不喘。</p>
<h3>學到的事</h3>
<ul>
<li>慢慢加量，比一次衝太快更能持續</li>
<li>跑前動態伸展，膝蓋負擔小很多</li>
<li>固定時間跑，最容易養成習慣</li>
</ul>`,
    },
    {
      key: "subtract-book",
      title: "產品設計：減法的力量",
      tagKey: "study",
      createdOffset: -4,
      html: `<p>讀完《<em>Subtract</em>》第 2 章，幾個重點：</p>
<blockquote><p>人類天生傾向「加東西」來解決問題，但研究顯示主動「減東西」往往效果更好。</p></blockquote>
<h3>對 Nudge 的啟發</h3>
<ul>
<li>不要為了「完整性」加功能</li>
<li><strong>YAGNI</strong> 不只是工程原則，也是產品原則</li>
<li>每個功能都要問：刪掉會怎樣？</li>
</ul>
<h3>程式碼小技巧</h3>
<p>用 <code>color-mix()</code> 可以用一個變數產生半透明版本，省下一組 token。</p>`,
    },
    {
      key: "kyoto-trip",
      title: "週末京都小旅行計畫",
      tagKey: "life",
      createdOffset: -7,
      html: `<p>四天三夜。想去的地方：</p>
<ul>
<li>嵐山竹林</li>
<li>伏見稻荷</li>
<li>鴨川散步</li>
</ul>
<p>住宿想試試<strong>町家風格</strong>。交通用 ICOCA 比較方便。</p>`,
    },
  ],
  notes: [
    {
      key: "note-today",
      dayOffset: 0,
      lines: [
        "早上去跑了 5 公里。久沒動了，膝蓋提醒我要重新適應。",
        "晚上吃得清淡一點，意外地比想像中舒服。",
      ],
    },
    {
      key: "note-yesterday",
      dayOffset: -1,
      lines: [
        "會議很多，但意外談出了下季的方向。",
        "重點不是開多少會，是有沒有留下可以行動的結論。",
      ],
    },
    {
      key: "note-2days",
      dayOffset: -2,
      lines: [
        "讀了一篇關於「慢下來反而走得更遠」的文章。",
        "很多時候我以為是生產力問題，其實是注意力問題。",
      ],
    },
  ],
};
