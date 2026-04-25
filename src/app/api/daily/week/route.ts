import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  dailyTaskAssignments,
  tasks,
  taskRecurrences,
} from "@/lib/db/schema";
import { and, gte, lte, eq, ne } from "drizzle-orm";
import { getUser } from "@/lib/get-user";
import { occurrencesInRange, type RecurrenceRule } from "@/lib/recurrence";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }

  // 1. Already-materialized assignments in the window.
  const assignments = await db
    .select({ date: dailyTaskAssignments.date })
    .from(dailyTaskAssignments)
    .innerJoin(tasks, eq(dailyTaskAssignments.taskId, tasks.id))
    .where(
      and(
        gte(dailyTaskAssignments.date, start),
        lte(dailyTaskAssignments.date, end),
        eq(dailyTaskAssignments.isSkipped, false),
        eq(tasks.userId, user.id),
      ),
    );

  const dates = new Set<string>(assignments.map((a) => a.date));

  // 2. Virtual occurrences from active recurrences. Daily-page GET will
  //    materialize them on demand, but the week strip's dot indicator
  //    needs to know about future occurrences before the user navigates
  //    there — otherwise a 「每天」rule looks like it only fires today.
  const userRecurrences = await db
    .select({
      preset: taskRecurrences.preset,
      weekdays: taskRecurrences.weekdays,
      monthDay: taskRecurrences.monthDay,
      monthNth: taskRecurrences.monthNth,
      monthNthWeekday: taskRecurrences.monthNthWeekday,
      startDate: taskRecurrences.startDate,
      endDate: taskRecurrences.endDate,
    })
    .from(taskRecurrences)
    .innerJoin(tasks, eq(tasks.id, taskRecurrences.taskId))
    .where(and(eq(tasks.userId, user.id), ne(tasks.status, "archived")));

  for (const rec of userRecurrences) {
    if (rec.endDate && rec.endDate < start) continue;
    if (rec.startDate > end) continue;
    const rule: RecurrenceRule = {
      preset: rec.preset as RecurrenceRule["preset"],
      weekdays: rec.weekdays,
      monthDay: rec.monthDay,
      monthNth: rec.monthNth,
      monthNthWeekday: rec.monthNthWeekday,
      startDate: rec.startDate,
      endDate: rec.endDate,
    };
    const windowFrom = rec.startDate > start ? rec.startDate : start;
    const windowTo = rec.endDate && rec.endDate < end ? rec.endDate : end;
    for (const d of occurrencesInRange(rule, windowFrom, windowTo)) {
      dates.add(d);
    }
  }

  return NextResponse.json({ datesWithTasks: [...dates].sort() });
}
