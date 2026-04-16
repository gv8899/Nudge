import { cookies } from "next/headers";

export async function getToday(): Promise<string> {
  const cookieStore = await cookies();
  const tz = cookieStore.get("nudge:tz")?.value || "UTC";
  return todayInTz(tz);
}

function todayInTz(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")!.value;
    const m = parts.find((p) => p.type === "month")!.value;
    const d = parts.find((p) => p.type === "day")!.value;
    return `${y}-${m}-${d}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
