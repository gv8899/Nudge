// TODO(review): ja translations authored by Claude — please review wording.
// 日本語のオンボーディング用サンプルコンテンツ。対象：オフィスワーカー。
// 構造と key は zh-TW.ts と一致させること（content-parity テストが検出）。

import type { OnboardingContent } from "./types";

export const ja: OnboardingContent = {
  tags: [
    { key: "meeting-notes", name: "議事録", color: "chart-1" },
    { key: "knowledge", name: "ナレッジ", color: "chart-2" },
    { key: "checklist", name: "チェックリスト", color: "chart-3" },
  ],
  tasks: [
    // 今日（リマインド／プッシュなし）
    { key: "weekly-sync-prep", title: "週次会議の資料準備", dayOffset: 0 },
    { key: "standup", title: "朝のスタンドアップ", dayOffset: 0, recurrence: "weekdays" },
    // 前の日にやり残し → 今日に自動で繰り越し（期限切れ）
    { key: "vendor-followup", title: "ベンダーの見積もりを催促", dayOffset: -1 },
  ],
  cards: [
    {
      key: "nudge-guide",
      title: "Nudge の使い方",
      tagKey: "knowledge",
      createdOffset: 0, // 最新 → カード一覧の最上部
      html: `<h2>Nudge をはじめる</h2>
<p>その日やることを入れて、終わったらチェック。<strong>やり残したものは、翌日の「今日」に自動で出てきます</strong>——消えないし、手で動かす必要もありません。</p>
<h3>いくつかの良い習慣</h3>
<ul>
<li>朝いちばんに「今日」を見て、重要な3つを先頭に</li>
<li>ふと思いついたことはカードに記録、あとで整理</li>
<li>繰り返しの仕事は毎週／毎日の繰り返しに設定してリマインドに任せる</li>
</ul>
<blockquote><p>まず一日を空にする、きれいにするのはその次。</p></blockquote>`,
    },
    {
      key: "product-meeting",
      title: "製品開発ミーティング議事録",
      tagKey: "meeting-notes",
      createdOffset: -1,
      html: `<h2>製品開発 週次ミーティング</h2>
<p><strong>日時：</strong>月 10:00　<strong>出席：</strong>PM・デザイン・エンジニア</p>
<h3>決定事項</h3>
<ul>
<li>次リリースは「新規オンボーディング」に注力、他の要望は後回し</li>
<li>デザインは今週プロトタイプを2案、木曜レビュー</li>
<li>エンジニアはまず API 契約を確定し手戻りを防ぐ</li>
</ul>
<h3>アクション</h3>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><div><p>PM：要件の優先順位付け（水曜まで）</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>デザイン：プロトA／B（木曜レビュー）</p></div></li>
</ul>`,
    },
    {
      key: "travel-checklist",
      title: "出張チェックリスト",
      tagKey: "checklist",
      createdOffset: -2,
      html: `<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><div><p>パスポート残存6か月以上</p></div></li>
<li data-type="taskItem" data-checked="true"><div><p>航空券と搭乗書類</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>現地の通信／ローミング</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>変換プラグとモバイルバッテリー</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>宿泊・交通予約のスクショ</p></div></li>
</ul>`,
    },
  ],
  notes: [],
};
