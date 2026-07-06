// TODO(review): ja translations authored by Claude — please review wording.
// 日本語のオンボーディング用サンプルコンテンツ。構造と key は zh-TW.ts と
// 一致させること（content-parity テストが差異を検出する）。

import type { OnboardingContent } from "./types";

export const ja: OnboardingContent = {
  tags: [
    { key: "work", name: "仕事", color: "chart-1" },
    { key: "study", name: "勉強", color: "chart-2" },
    { key: "exercise", name: "運動", color: "chart-3" },
    { key: "life", name: "生活", color: "chart-4" },
  ],
  tasks: [
    { key: "morning-exercise", title: "朝の運動", dayOffset: 0, done: true },
    {
      key: "weekly-report",
      title: "週報を書く",
      dayOffset: 0,
      recurrence: "weekly_fri",
      remindAtTimeOfDay: "17:00",
    },
    { key: "prep-slides", title: "スライドの準備", dayOffset: 0 },
    { key: "read-chapter", title: "1章読む", dayOffset: 0 },
    { key: "standup", title: "朝のスタンドアップ", dayOffset: 0, recurrence: "weekdays" },
    // 期限切れ（数日前のもの）
    { key: "pay-bills", title: "光熱費を払う", dayOffset: -5 },
    { key: "reply-client", title: "顧客メールに返信", dayOffset: -3 },
  ],
  cards: [
    {
      key: "okr",
      title: "Q2 チーム OKR ミーティング",
      tagKey: "work",
      createdOffset: -1,
      html: `<h2>来四半期の方向性</h2>
<p>今日の会議で、思いがけず来四半期の方向性が見えた。大事なのは会議の数ではなく、<strong>行動につながる結論</strong>が残せたかどうか。</p>
<h3>3つの Key Result</h3>
<ul>
<li>新規ユーザーのアクティベーション率を 32% から 45% へ</li>
<li>コアフローの P50 レイテンシを 200ms 未満に</li>
<li>毎週プロダクトノートを1本出す</li>
</ul>
<blockquote><p>指標を大量に追うより、1つをやり切る。</p></blockquote>`,
    },
    {
      key: "running-notes",
      title: "ランニング記録：最初の1か月",
      tagKey: "exercise",
      createdOffset: -3,
      html: `<p>走り始めは膝が痛く、ペースもつかめなかった。3週間で体が慣れ、5K から息が上がらず 8K 走れるように。</p>
<h3>学んだこと</h3>
<ul>
<li>一気に飛ばすより、少しずつ増やす方が続く</li>
<li>走る前の動的ストレッチで膝の負担がぐっと減る</li>
<li>決まった時間に走るのが、習慣化の一番の近道</li>
</ul>`,
    },
    {
      key: "subtract-book",
      title: "プロダクトデザイン：引き算の力",
      tagKey: "study",
      createdOffset: -4,
      html: `<p>『<em>Subtract</em>』第2章を読了。いくつかの要点：</p>
<blockquote><p>人は問題解決のために本能的に「足す」が、研究では意図的に「引く」方が効果的なことが多い。</p></blockquote>
<h3>Nudge への示唆</h3>
<ul>
<li>「完全性」のために機能を足さない</li>
<li><strong>YAGNI</strong> はエンジニアリングだけでなく、プロダクトの原則でもある</li>
<li>どの機能にも問う：消したらどうなる？</li>
</ul>
<h3>コードの小技</h3>
<p><code>color-mix()</code> を使えば1つの変数から半透明版を作れて、トークンを1組節約できる。</p>`,
    },
    {
      key: "kyoto-trip",
      title: "週末の京都小旅行プラン",
      tagKey: "life",
      createdOffset: -7,
      html: `<p>3泊4日。行きたい場所：</p>
<ul>
<li>嵐山の竹林</li>
<li>伏見稲荷</li>
<li>鴨川さんぽ</li>
</ul>
<p>宿は<strong>町家スタイル</strong>を試したい。移動は ICOCA が便利。</p>`,
    },
  ],
  notes: [
    {
      key: "note-today",
      dayOffset: 0,
      lines: [
        "朝に5キロ走った。久しぶりで、膝が「慣らし直せ」と言ってくる。",
        "夜は少しあっさりめに。思ったより心地よかった。",
      ],
    },
    {
      key: "note-yesterday",
      dayOffset: -1,
      lines: [
        "会議は多かったが、思いがけず来四半期の方向性が見えた。",
        "大事なのは会議の数ではなく、行動につながる結論が残るかどうか。",
      ],
    },
    {
      key: "note-2days",
      dayOffset: -2,
      lines: [
        "「ゆっくりの方が遠くまで行ける」という記事を読んだ。",
        "生産性の問題だと思っていたことの多くは、実は注意力の問題だった。",
      ],
    },
  ],
};
