import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyTaskAssignments, tasks } from "@/lib/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }

  const assignments = await db
    .select({ date: dailyTaskAssignments.date })
    .from(dailyTaskAssignments)
    .innerJoin(tasks, eq(dailyTaskAssignments.taskId, tasks.id))
    .where(
      and(
        gte(dailyTaskAssignments.date, start),
        lte(dailyTaskAssignments.date, end),
        eq(tasks.userId, user.id)
      )
    );

  const datesWithTasks = [...new Set(assignments.map((a) => a.date))];
  return NextResponse.json({ datesWithTasks });
}
