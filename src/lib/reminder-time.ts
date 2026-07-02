/**
 * 絕對提醒時間（tasks.remindAt）的組裝/拆解。
 * 存 UTC ISO（Apple 端 parseISODateTime 可讀）；輸入輸出都用使用者 local 時區。
 */
export function composeRemindAtISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function splitRemindAtISO(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
