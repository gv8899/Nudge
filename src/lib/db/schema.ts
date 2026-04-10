import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["inbox", "backlog", "in_progress", "waiting", "done", "archived"],
  })
    .notNull()
    .default("inbox"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
  remindAt: text("remind_at"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("chart-1"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const taskTags = pgTable("task_tags", {
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

export const statusHistory = pgTable("status_history", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedAt: text("changed_at").notNull(),
  note: text("note"),
});

export const dailyTaskAssignments = pgTable("daily_task_assignments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const dailyNotes = pgTable("daily_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
