// MCP 工具在同一個 process 內直接呼叫既有 API route handler（重用所有商業規則
// 與即時同步通知）。handler 內部用 getUser() 取身分；這裡用 AsyncLocalStorage
// 把「已驗過 MCP access token 的使用者」帶進去，getUser() 會優先讀它。
//
// MCP token 本身不是 JWT，直接拿去打 /api/* 不會被 getUser() 接受 ——
// 只有經過 /api/mcp 驗證後、在這個 context 內執行的呼叫才算數。

import { AsyncLocalStorage } from "async_hooks";
import type { users } from "@/lib/db/schema";

export type McpUser = typeof users.$inferSelect;

export const mcpUserContext = new AsyncLocalStorage<McpUser>();
