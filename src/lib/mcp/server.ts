// Nudge MCP 連接器：AI 服務（Claude / ChatGPT…）可呼叫的工具與範例提示。
//
// 設計：工具不另寫一套 DB 邏輯，而是在同一個 process 內呼叫既有 API route
// handler（身分由 ./context 的 AsyncLocalStorage 帶入），所以完成任務、移日、
// 重複任務展開、即時同步通知等規則跟 App 完全一致。
//
// 確認規則（產品決定）：新增 = 直接做；修改 / 刪除 = 標 destructiveHint，
// 交給 AI 服務在執行前問使用者。

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NextRequest } from "next/server";
import { ownsAllTags, ownsTask, ownedAssignmentTaskId } from "@/lib/ownership";
import { hasActiveEntitlement } from "@/lib/entitlement";
import { stripHtml } from "@/lib/strip-html";
import { TASK_STATUS_LIST } from "@/lib/constants";
import { oauthBaseUrl } from "@/lib/oauth/store";
import { markdownToHtml } from "./markdown";
import type { McpUser } from "./context";

import * as tasksRoute from "@/app/api/tasks/route";
import * as taskRoute from "@/app/api/tasks/[id]/route";
import * as taskStatusRoute from "@/app/api/tasks/[id]/status/route";
import * as taskTagsRoute from "@/app/api/tasks/[id]/tags/route";
import * as cardsRoute from "@/app/api/cards/route";
import * as dailyRoute from "@/app/api/daily/[date]/route";
import * as dailyTasksRoute from "@/app/api/daily/[date]/tasks/route";
import * as dailyNotesRoute from "@/app/api/daily/[date]/notes/route";
import * as assignmentRoute from "@/app/api/daily-assignments/[id]/route";
import * as notesFeedRoute from "@/app/api/notes/feed/route";
import * as tagsRoute from "@/app/api/tags/route";
import * as tagRoute from "@/app/api/tags/[id]/route";
import * as calendarEventsRoute from "@/app/api/calendar/events/route";

// ── 呼叫既有 route handler ─────────────────────────────────────────────────

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

class ToolError extends Error {}

// 既有 route 回應的最小型別（只列工具用得到的欄位）。
interface TaskRow {
  id: string;
  title: string;
  status: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  remindAt: string | null;
}
interface TagRow {
  id: string;
  name: string;
  color: string;
}
interface DayRow {
  id: string;
  taskId: string;
  date: string;
  isCompleted: boolean;
  isRecurring: boolean;
  hasReminder: boolean;
  task: TaskRow;
}
interface HistoryRow {
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  note: string | null;
}
interface EventRow {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  calendarName: string;
}

async function call<T = unknown>(
  handler: unknown,
  opts: {
    method: string;
    path: string;
    query?: Record<string, string | undefined>;
    params?: Record<string, string>;
    body?: unknown;
  },
): Promise<T> {
  const url = new URL(opts.path, oauthBaseUrl());
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  const req = new NextRequest(url, {
    method: opts.method,
    headers: { "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await (handler as Handler)(req, {
    params: Promise.resolve(opts.params ?? {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ToolError(
      res.status === 404 ? "Not found." : `Request failed (${res.status}): ${data?.error ?? text}`,
    );
  }
  return data as T;
}

// ── 所有權檢查（共用 @/lib/ownership；這裡只轉成工具錯誤訊息）──

async function assertOwnsTask(userId: string, taskId: string) {
  if (!(await ownsTask(userId, taskId))) throw new ToolError(`Task ${taskId} not found.`);
}

async function assertOwnsAssignment(userId: string, assignmentId: string) {
  const taskId = await ownedAssignmentTaskId(userId, assignmentId);
  if (!taskId) throw new ToolError(`Day entry ${assignmentId} not found.`);
  return taskId;
}

async function assertOwnsTags(userId: string, tagIds: string[]) {
  if (!(await ownsAllTags(userId, tagIds))) throw new ToolError("Unknown tag id.");
}

// ── 輸出整形 ───────────────────────────────────────────────────────────────

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }],
});

function dayEntry(a: DayRow) {
  return {
    entryId: a.id,
    taskId: a.taskId,
    date: a.date,
    title: a.task.title,
    status: a.task.status,
    done: a.isCompleted,
    recurring: a.isRecurring,
    hasReminder: a.hasReminder,
    hasContent: !!a.task.description && stripHtml(a.task.description).length > 0,
    createdAt: a.task.createdAt,
    completedAt: a.task.completedAt,
  };
}

const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Date as YYYY-MM-DD in the user's local timezone");
const STATUS = z.enum(TASK_STATUS_LIST as [string, ...string[]]);

const STATUS_HELP =
  "Task status: inbox (captured, unsorted), backlog (to schedule), in_progress (doing it myself), " +
  "waiting (waiting on others), done, archived.";

// ── Server ────────────────────────────────────────────────────────────────

export function createNudgeMcpServer(user: McpUser): McpServer {
  const server = new McpServer(
    { name: "nudge", title: "Nudge", version: "1.0.0" },
    {
      instructions:
        "Nudge is the user's personal task, daily-plan and notes app. " +
        "A 'task' has a title, a status and optional rich content; a task with content is shown as a 'card'. " +
        "Tasks are put on specific days (day entries); unfinished entries from past days are 'overdue'. " +
        "Each day also has one free-form daily note. " +
        "Always use the user's local date. Before changing or deleting something, read it first and tell the user exactly what will change. " +
        "Reply in the user's language" +
        (user.locale ? ` (their Nudge language is ${user.locale}).` : "."),
    },
  );

  // 付費功能：每次呼叫工具時檢查（試用期也算有權）。
  const guard =
    <A,>(fn: (args: A) => Promise<unknown>) =>
    async (args: A) => {
      try {
        if (!(await hasActiveEntitlement(user.id))) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `The Nudge connector needs an active Nudge subscription. The user can subscribe at ${oauthBaseUrl()}/pricing`,
              },
            ],
          };
        }
        return ok(await fn(args));
      } catch (e) {
        const message = e instanceof ToolError ? e.message : "Unexpected error. Please try again.";
        if (!(e instanceof ToolError)) console.error("[mcp] tool error", e);
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    };

  const READ = { readOnlyHint: true, openWorldHint: false } as const;
  const CREATE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
  const CHANGE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

  // ── 讀取 ──

  server.registerTool(
    "get_day",
    {
      title: "Get a day's plan",
      description:
        "Get the tasks planned for a date (with done state), all overdue unfinished tasks from earlier days, and that day's daily note.",
      inputSchema: { date: DATE },
      annotations: READ,
    },
    guard(async ({ date }: { date: string }) => {
      const d = await call<{ assignments: DayRow[]; overdueTasks: DayRow[]; noteContent: string }>(dailyRoute.GET, { method: "GET", path: `/api/daily/${date}`, params: { date } });
      return {
        date,
        entries: d.assignments.map(dayEntry),
        overdue: d.overdueTasks.map(dayEntry),
        dailyNote: stripHtml(d.noteContent || ""),
      };
    }),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: `List the user's tasks (with created / updated / completed times), most recently updated first. Archived tasks are excluded unless status=archived. ${STATUS_HELP}`,
      inputSchema: {
        status: STATUS.optional(),
        limit: z.number().int().min(1).max(200).default(50),
      },
      annotations: READ,
    },
    guard(async ({ status, limit }: { status?: string; limit: number }) => {
      const rows = await call<TaskRow[]>(tasksRoute.GET, {
        method: "GET",
        path: "/api/tasks",
        query: { status },
      });
      return rows
        .filter((t) => status || t.status !== "archived")
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, limit)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          completedAt: t.completedAt,
          remindAt: t.remindAt,
          hasContent: !!t.description && stripHtml(t.description).length > 0,
        }));
    }),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get a task / card",
      description:
        "Get one task with its full content (HTML), tags and status history. Use this before editing a card.",
      inputSchema: { task_id: z.string() },
      annotations: READ,
    },
    guard(async ({ task_id }: { task_id: string }) => {
      const t = await call<TaskRow & { tags: TagRow[] }>(taskRoute.GET, { method: "GET", path: `/api/tasks/${task_id}`, params: { id: task_id } });
      const history = await call<HistoryRow[]>(taskStatusRoute.GET, {
        method: "GET",
        path: `/api/tasks/${task_id}/status`,
        params: { id: task_id },
      });
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        tags: t.tags,
        remindAt: t.remindAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        completedAt: t.completedAt,
        contentHtml: t.description ?? "",
        statusHistory: history.map((h) => ({ from: h.fromStatus, to: h.toStatus, at: h.changedAt, note: h.note })),
      };
    }),
  );

  server.registerTool(
    "search_cards",
    {
      title: "Search cards",
      description:
        "Search the user's cards (tasks that have content) by text in title or content, optionally filtered by tags (all must match). Without a query, returns the most recently updated cards.",
      inputSchema: {
        query: z.string().optional(),
        tag_ids: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: READ,
    },
    guard(async ({ query, tag_ids, limit }: { query?: string; tag_ids?: string[]; limit: number }) => {
      const r = await call<{ cards: (TaskRow & { tags: TagRow[] })[] }>(cardsRoute.GET, {
        method: "GET",
        path: "/api/cards",
        query: { q: query, limit: String(limit), tagIds: tag_ids?.join(",") },
      });
      return r.cards.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        tags: c.tags.map((t) => t.name),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        preview: stripHtml(c.description ?? "", 300),
      }));
    }),
  );

  server.registerTool(
    "list_tags",
    { title: "List tags", description: "List the user's tags (id, name, color).", annotations: READ },
    guard(async () =>
      (await call<{ tags: TagRow[] }>(tagsRoute.GET, { method: "GET", path: "/api/tags" })).tags.map(
        (t) => ({ id: t.id, name: t.name, color: t.color }),
      ),
    ),
  );

  server.registerTool(
    "list_daily_notes",
    {
      title: "List daily notes",
      description: "List the user's non-empty daily notes, newest first. Use `before` (YYYY-MM-DD, exclusive) to page back.",
      inputSchema: {
        before: DATE.optional(),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: READ,
    },
    guard(async ({ before, limit }: { before?: string; limit: number }) => {
      const r = await call<{ notes: { date: string; content: string }[] }>(notesFeedRoute.GET, {
        method: "GET",
        path: "/api/notes/feed",
        query: { cursor: before, limit: String(limit) },
      });
      return r.notes.map((n) => ({ date: n.date, text: stripHtml(n.content) }));
    }),
  );

  server.registerTool(
    "get_calendar_events",
    {
      title: "Get calendar events",
      description:
        "Get the user's Google Calendar events (calendars they selected in Nudge) for a date range. Returns connected=false if the user has not connected Google Calendar in Nudge.",
      inputSchema: {
        start_date: DATE,
        end_date: DATE.optional().describe("Inclusive end date; defaults to start_date"),
        timezone: z.string().default("UTC").describe("IANA timezone of the user, e.g. Asia/Taipei"),
      },
      annotations: READ,
    },
    guard(async ({ start_date, end_date, timezone }: { start_date: string; end_date?: string; timezone: string }) => {
      const r = await call<{ connected: boolean; events?: EventRow[] }>(calendarEventsRoute.GET, {
        method: "GET",
        path: "/api/calendar/events",
        query: { date: start_date, endDate: end_date, tz: timezone },
      });
      if (!r.connected || !r.events) return { connected: false };
      return {
        connected: true,
        events: r.events.map((e) => ({
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          location: e.location,
          calendar: e.calendarName,
        })),
      };
    }),
  );

  // ── 新增（直接執行）──

  server.registerTool(
    "create_task",
    {
      title: "Create a task or card",
      description:
        `Create a new task. Give content (Markdown) to make it a card, e.g. research results or a trip plan. ` +
        `Give a date to also put it on that day's plan. ${STATUS_HELP} Default status: in_progress when a date is given, otherwise inbox.`,
      inputSchema: {
        title: z.string().min(1).max(500),
        content_markdown: z.string().optional(),
        status: STATUS.optional(),
        date: DATE.optional(),
      },
      annotations: CREATE,
    },
    guard(async (a: { title: string; content_markdown?: string; status?: string; date?: string }) => {
      const description = a.content_markdown ? markdownToHtml(a.content_markdown) : undefined;
      if (a.date) {
        const entry = await call<{ id: string; taskId: string }>(dailyTasksRoute.POST, {
          method: "POST",
          path: `/api/daily/${a.date}/tasks`,
          params: { date: a.date },
          body: { title: a.title, description, status: a.status },
        });
        return { created: true, taskId: entry.taskId, entryId: entry.id, date: a.date };
      }
      const t = await call<TaskRow>(tasksRoute.POST, {
        method: "POST",
        path: "/api/tasks",
        body: { title: a.title, description, status: a.status },
      });
      return { created: true, taskId: t.id, status: t.status };
    }),
  );

  server.registerTool(
    "schedule_task",
    {
      title: "Put a task on a day",
      description: "Put an existing task on a day's plan (no change if it is already there).",
      inputSchema: { task_id: z.string(), date: DATE },
      annotations: CREATE,
    },
    guard(async ({ task_id, date }: { task_id: string; date: string }) => {
      await assertOwnsTask(user.id, task_id);
      const entry = await call<{ id: string; taskId: string }>(dailyTasksRoute.POST, {
        method: "POST",
        path: `/api/daily/${date}/tasks`,
        params: { date },
        body: { taskId: task_id },
      });
      return { scheduled: true, entryId: entry.id, date };
    }),
  );

  server.registerTool(
    "create_tag",
    {
      title: "Create a tag",
      description: "Create a new tag.",
      inputSchema: { name: z.string().min(1).max(50) },
      annotations: CREATE,
    },
    guard(async ({ name }: { name: string }) => {
      const t = await call<TagRow>(tagsRoute.POST, { method: "POST", path: "/api/tags", body: { name } });
      return { created: true, tagId: t.id, name: t.name };
    }),
  );

  // ── 修改（需使用者確認）──

  server.registerTool(
    "update_task",
    {
      title: "Edit a task / card",
      description:
        "Change a task's title, reminder, and/or content. content_mode=append adds Markdown to the end of the existing content; " +
        "content_mode=replace overwrites it (existing images are lost unless kept as ![](/api/attachments/<id>)). " +
        "Read the task with get_task first.",
      inputSchema: {
        task_id: z.string(),
        title: z.string().min(1).max(500).optional(),
        content_markdown: z.string().optional(),
        content_mode: z.enum(["append", "replace"]).default("append"),
        remind_at: z
          .string()
          .nullable()
          .optional()
          .describe("ISO 8601 date-time with timezone offset for a one-time reminder, or null to clear"),
      },
      annotations: CHANGE,
    },
    guard(
      async (a: {
        task_id: string;
        title?: string;
        content_markdown?: string;
        content_mode: "append" | "replace";
        remind_at?: string | null;
      }) => {
        const body: Record<string, unknown> = {};
        if (a.title !== undefined) body.title = a.title;
        if (a.remind_at !== undefined) body.remindAt = a.remind_at;
        if (a.content_markdown !== undefined) {
          const html = markdownToHtml(a.content_markdown);
          if (a.content_mode === "append") {
            const current = await call<TaskRow>(taskRoute.GET, {
              method: "GET",
              path: `/api/tasks/${a.task_id}`,
              params: { id: a.task_id },
            });
            body.description = `${current.description ?? ""}${html}`;
          } else {
            body.description = html;
          }
        }
        if (Object.keys(body).length === 0) throw new ToolError("Nothing to change.");
        const t = await call<TaskRow>(taskRoute.PATCH, {
          method: "PATCH",
          path: `/api/tasks/${a.task_id}`,
          params: { id: a.task_id },
          body,
        });
        return { updated: true, taskId: t.id, title: t.title, updatedAt: t.updatedAt };
      },
    ),
  );

  server.registerTool(
    "set_task_status",
    {
      title: "Change task status",
      description: `Change a task's status. ${STATUS_HELP}`,
      inputSchema: { task_id: z.string(), status: STATUS, note: z.string().max(500).optional() },
      annotations: CHANGE,
    },
    guard(async ({ task_id, status, note }: { task_id: string; status: string; note?: string }) => {
      const t = await call<TaskRow>(taskStatusRoute.PATCH, {
        method: "PATCH",
        path: `/api/tasks/${task_id}/status`,
        params: { id: task_id },
        body: { status, note },
      });
      return { updated: true, taskId: t.id, status: t.status };
    }),
  );

  server.registerTool(
    "set_day_entry_done",
    {
      title: "Check / uncheck a day entry",
      description:
        "Mark a task on a day's plan as done or not done (entryId from get_day). Marking done also sets a non-recurring task's status to done; recurring tasks keep their status.",
      inputSchema: { entry_id: z.string(), done: z.boolean() },
      annotations: CHANGE,
    },
    guard(async ({ entry_id, done }: { entry_id: string; done: boolean }) => {
      await assertOwnsAssignment(user.id, entry_id);
      await call(dailyTasksRoute.PATCH, {
        method: "PATCH",
        path: "/api/daily/x/tasks",
        body: { assignmentId: entry_id, isCompleted: done },
      });
      return { updated: true, entryId: entry_id, done };
    }),
  );

  server.registerTool(
    "move_day_entry",
    {
      title: "Move a day entry to another date",
      description:
        "Move a task from one day's plan to another date (entryId from get_day). Earlier unfinished copies of the same task are cleared.",
      inputSchema: { entry_id: z.string(), to_date: DATE },
      annotations: CHANGE,
    },
    guard(async ({ entry_id, to_date }: { entry_id: string; to_date: string }) => {
      await assertOwnsAssignment(user.id, entry_id);
      await call(dailyTasksRoute.PATCH, {
        method: "PATCH",
        path: "/api/daily/x/tasks",
        body: { assignmentId: entry_id, moveToDate: to_date },
      });
      return { moved: true, toDate: to_date };
    }),
  );

  server.registerTool(
    "remove_day_entry",
    {
      title: "Remove a task from a day",
      description:
        "Take a task off one day's plan (entryId from get_day). The task itself is kept. For a recurring task this skips only that occurrence.",
      inputSchema: { entry_id: z.string() },
      annotations: CHANGE,
    },
    guard(async ({ entry_id }: { entry_id: string }) => {
      await assertOwnsAssignment(user.id, entry_id);
      await call(assignmentRoute.PATCH, {
        method: "PATCH",
        path: `/api/daily-assignments/${entry_id}`,
        params: { id: entry_id },
        body: { isSkipped: true },
      });
      return { removed: true, entryId: entry_id };
    }),
  );

  server.registerTool(
    "set_task_tags",
    {
      title: "Set a task's tags",
      description: "Replace all tags on a task with the given tag ids (from list_tags). Pass [] to remove all.",
      inputSchema: { task_id: z.string(), tag_ids: z.array(z.string()) },
      annotations: CHANGE,
    },
    guard(async ({ task_id, tag_ids }: { task_id: string; tag_ids: string[] }) => {
      await assertOwnsTags(user.id, tag_ids);
      await call(taskTagsRoute.PUT, {
        method: "PUT",
        path: `/api/tasks/${task_id}/tags`,
        params: { id: task_id },
        body: { tagIds: [...new Set(tag_ids)] },
      });
      return { updated: true, taskId: task_id, tagIds: tag_ids };
    }),
  );

  server.registerTool(
    "write_daily_note",
    {
      title: "Write the daily note",
      description:
        "Write a day's daily note in Markdown. mode=append adds to the end; mode=replace overwrites the whole note.",
      inputSchema: {
        date: DATE,
        content_markdown: z.string().min(1),
        mode: z.enum(["append", "replace"]).default("append"),
      },
      annotations: CHANGE,
    },
    guard(async ({ date, content_markdown, mode }: { date: string; content_markdown: string; mode: "append" | "replace" }) => {
      const html = markdownToHtml(content_markdown);
      let content = html;
      if (mode === "append") {
        const current = await call<{ content: string }>(dailyNotesRoute.GET, {
          method: "GET",
          path: `/api/daily/${date}/notes`,
          params: { date },
        });
        const existing = current.content === "<p></p>" ? "" : current.content ?? "";
        content = `${existing}${html}`;
      }
      await call(dailyNotesRoute.PUT, {
        method: "PUT",
        path: `/api/daily/${date}/notes`,
        params: { date },
        body: { content },
      });
      return { updated: true, date };
    }),
  );

  // ── 刪除（需使用者確認）──

  server.registerTool(
    "delete_task",
    {
      title: "Delete a task / card",
      description:
        "Permanently delete a task, its content and all its day entries. This cannot be undone; consider set_task_status archived instead.",
      inputSchema: { task_id: z.string() },
      annotations: CHANGE,
    },
    guard(async ({ task_id }: { task_id: string }) => {
      await assertOwnsTask(user.id, task_id);
      await call(taskRoute.DELETE, { method: "DELETE", path: `/api/tasks/${task_id}`, params: { id: task_id } });
      return { deleted: true, taskId: task_id };
    }),
  );

  server.registerTool(
    "delete_tag",
    {
      title: "Delete a tag",
      description: "Delete a tag and remove it from all tasks. Tasks themselves are kept.",
      inputSchema: { tag_id: z.string() },
      annotations: CHANGE,
    },
    guard(async ({ tag_id }: { tag_id: string }) => {
      await call(tagRoute.DELETE, { method: "DELETE", path: `/api/tags/${tag_id}`, params: { id: tag_id } });
      return { deleted: true, tagId: tag_id };
    }),
  );

  // ── 範例提示（在 AI 服務裡一鍵觸發）──

  const prompt = (name: string, title: string, description: string, text: string) =>
    server.registerPrompt(name, { title, description }, () => ({
      messages: [{ role: "user", content: { type: "text", text } }],
    }));

  prompt(
    "yesterday_recap",
    "Yesterday recap",
    "Summarise what I did yesterday in Nudge",
    "Using Nudge, recap my yesterday (my local date minus one day): call get_day for yesterday, then tell me what I finished, " +
      "what I didn't finish, anything still overdue, and the gist of my daily note. Keep it short and end with one suggestion for today. " +
      "Don't change anything.",
  );
  prompt(
    "plan_today",
    "Plan today",
    "Look at today's plan, overdue tasks and calendar, and suggest a plan",
    "Using Nudge, help me plan today: call get_day for today and get_calendar_events for today, then suggest an order of work " +
      "that fits around my meetings and flag overdue tasks I should reschedule or drop. Ask before changing anything.",
  );
  prompt(
    "weekly_review",
    "Weekly review",
    "Review the past 7 days in Nudge",
    "Using Nudge, review my last 7 days: call get_day for each of the past 7 days and list_daily_notes, then summarise what I " +
      "completed, recurring patterns in what slips, and three suggestions for next week. Don't change anything.",
  );

  return server;
}
