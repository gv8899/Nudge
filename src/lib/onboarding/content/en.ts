// TODO(review): en translations authored by Claude — please review wording.
// English onboarding sample content. Audience: office workers. Structure &
// keys must match zh-TW.ts (content-parity test enforces this).

import type { OnboardingContent } from "./types";

export const en: OnboardingContent = {
  tags: [
    { key: "meeting-notes", name: "Meeting notes", color: "chart-1" },
    { key: "knowledge", name: "Knowledge", color: "chart-2" },
    { key: "checklist", name: "Checklist", color: "chart-3" },
  ],
  tasks: [
    // Today
    { key: "inbox-cleared", title: "Clear the morning inbox", dayOffset: 0, done: true },
    { key: "reply-client", title: "Reply to client email", dayOffset: 0 },
    { key: "weekly-sync-prep", title: "Prep the weekly sync deck", dayOffset: 0 },
    {
      key: "weekly-report",
      title: "Write the weekly report",
      dayOffset: 0,
      recurrence: "weekly_fri",
      remindAtTimeOfDay: "17:00",
    },
    { key: "standup", title: "Daily stand-up", dayOffset: 0, recurrence: "weekdays" },
    // Left unfinished on earlier days → rolled over to today as overdue
    { key: "expense-report", title: "Submit last month's expenses", dayOffset: -2 },
    { key: "vendor-followup", title: "Follow up on the vendor quote", dayOffset: -1 },
  ],
  cards: [
    {
      key: "nudge-guide",
      title: "How to use Nudge",
      tagKey: "knowledge",
      createdOffset: 0, // newest → top of the cards list
      html: `<h2>Getting started with Nudge</h2>
<p>Drop in what you need to do each day and check it off when it's done. <strong>Anything you don't finish shows up again on "Today" tomorrow</strong> — it never disappears, and you never have to move it by hand.</p>
<h3>A few good habits</h3>
<ul>
<li>Look at "Today" first thing, and put your top three at the top</li>
<li>Capture stray thoughts as cards, tidy them up later</li>
<li>Set recurring work to repeat weekly / daily and let reminders carry it</li>
</ul>
<blockquote><p>Clear the day first, polish it second.</p></blockquote>`,
    },
    {
      key: "product-meeting",
      title: "Product dev meeting notes",
      tagKey: "meeting-notes",
      createdOffset: -1,
      html: `<h2>Product weekly sync</h2>
<p><strong>When:</strong> Mon 10:00　<strong>Present:</strong> PM, Design, Eng</p>
<h3>Decisions</h3>
<ul>
<li>Next release focuses on the new-user onboarding flow; other requests deferred</li>
<li>Design delivers two prototypes this week, review Thursday</li>
<li>Eng locks the API contract first to avoid rework</li>
</ul>
<h3>Action items</h3>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><div><p>PM: prioritize the backlog (by Wed)</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>Design: prototypes A / B (review Thursday)</p></div></li>
</ul>`,
    },
    {
      key: "travel-checklist",
      title: "Trip checklist",
      tagKey: "checklist",
      createdOffset: -2,
      html: `<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><div><p>Passport valid 6+ months</p></div></li>
<li data-type="taskItem" data-checked="true"><div><p>Flights and boarding docs</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>Local data / roaming</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>Adapter and power bank</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>Screenshots of hotel and transit bookings</p></div></li>
</ul>`,
    },
  ],
  notes: [],
};
