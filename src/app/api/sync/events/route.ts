import { NextRequest } from "next/server";
import { getUser } from "@/lib/get-user";
import { ensureListener, getRegistry, type SyncEvent } from "@/lib/sync-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

/**
 * 卡片即時同步的 SSE 端點。登入後每個 client 掛一條；server 收到該 user 的
 * 變動（sync-bus）就推 `event: change`。payload 只有 kind / id / updatedAt，
 * 不含內容 —— client 收到再用既有 owner-scoped GET 去抓。
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  ensureListener();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s));
      const send = (e: SyncEvent) => write(`event: change\ndata: ${JSON.stringify(e)}\n\n`);

      // 開場：讓 proxy / 瀏覽器立刻看到 body 開始（也驗證連線成功）
      write(`: connected\n\n`);
      const unsubscribe = getRegistry().subscribe(user.id, send);
      const heartbeat = setInterval(() => {
        try {
          write(`: ping\n\n`);
        } catch {
          /* controller 已關，由 abort 清理 */
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
