// TODO(review): en translations authored by Claude — please review wording.
// English onboarding sample content. Structure & keys must match zh-TW.ts
// (content-parity test enforces this).

import type { OnboardingContent } from "./types";

export const en: OnboardingContent = {
  tags: [
    { key: "work", name: "Work", color: "chart-1" },
    { key: "study", name: "Study", color: "chart-2" },
    { key: "exercise", name: "Exercise", color: "chart-3" },
    { key: "life", name: "Life", color: "chart-4" },
  ],
  tasks: [
    { key: "morning-exercise", title: "Morning workout", dayOffset: 0, done: true },
    {
      key: "weekly-report",
      title: "Write weekly report",
      dayOffset: 0,
      recurrence: "weekly_fri",
      remindAtTimeOfDay: "17:00",
    },
    { key: "prep-slides", title: "Prep the deck", dayOffset: 0 },
    { key: "read-chapter", title: "Read one chapter", dayOffset: 0 },
    { key: "standup", title: "Morning stand-up", dayOffset: 0, recurrence: "weekdays" },
    // Overdue (from earlier days)
    { key: "pay-bills", title: "Pay the utility bills", dayOffset: -5 },
    { key: "reply-client", title: "Reply to client email", dayOffset: -3 },
  ],
  cards: [
    {
      key: "okr",
      title: "Q2 team OKR discussion",
      tagKey: "work",
      createdOffset: -1,
      html: `<h2>Direction for next quarter</h2>
<p>Today's meeting unexpectedly surfaced our direction for next quarter. What matters isn't how many meetings we hold, but whether we walk away with an <strong>actionable conclusion</strong>.</p>
<h3>Three key results</h3>
<ul>
<li>Lift new-user activation from 32% to 45%</li>
<li>Bring the core flow's P50 latency under 200ms</li>
<li>Ship one product note every week</li>
</ul>
<blockquote><p>Rather than track a pile of metrics, nail one of them.</p></blockquote>`,
    },
    {
      key: "running-notes",
      title: "Running notes: first month",
      tagKey: "exercise",
      createdOffset: -3,
      html: `<p>At the start my knees ached and I couldn't hold a pace. After three weeks my body adapted — from 5K to running 8K without gasping.</p>
<h3>What I learned</h3>
<ul>
<li>Adding distance slowly lasts longer than sprinting once</li>
<li>A dynamic warm-up before running spares the knees a lot</li>
<li>Running at a fixed time is the easiest way to build the habit</li>
</ul>`,
    },
    {
      key: "subtract-book",
      title: "Product design: the power of subtraction",
      tagKey: "study",
      createdOffset: -4,
      html: `<p>Finished chapter 2 of <em>Subtract</em>. A few takeaways:</p>
<blockquote><p>People instinctively "add" to solve problems, but research shows that deliberately "subtracting" often works better.</p></blockquote>
<h3>What it means for Nudge</h3>
<ul>
<li>Don't add features for the sake of "completeness"</li>
<li><strong>YAGNI</strong> isn't only an engineering principle — it's a product one</li>
<li>For every feature, ask: what happens if we remove it?</li>
</ul>
<h3>A little code trick</h3>
<p>With <code>color-mix()</code> you can derive a translucent variant from a single variable, saving a whole extra token.</p>`,
    },
    {
      key: "kyoto-trip",
      title: "Weekend trip to Kyoto",
      tagKey: "life",
      createdOffset: -7,
      html: `<p>Four days, three nights. Places I want to see:</p>
<ul>
<li>Arashiyama bamboo grove</li>
<li>Fushimi Inari</li>
<li>A walk along the Kamo River</li>
</ul>
<p>Want to try a <strong>machiya-style</strong> stay. An ICOCA card makes getting around easier.</p>`,
    },
  ],
  notes: [
    {
      key: "note-today",
      dayOffset: 0,
      lines: [
        "Ran 5K this morning. Been a while — my knees reminded me to ease back in.",
        "Ate lighter tonight, and it felt surprisingly good.",
      ],
    },
    {
      key: "note-yesterday",
      dayOffset: -1,
      lines: [
        "Lots of meetings, but one unexpectedly clarified next quarter's direction.",
        "It's not about how many meetings — it's whether they leave an actionable conclusion.",
      ],
    },
    {
      key: "note-2days",
      dayOffset: -2,
      lines: [
        "Read an article on how slowing down actually gets you further.",
        "So often I think it's a productivity problem when it's really an attention problem.",
      ],
    },
  ],
};
