// apple/NudgeEditor/src/bridge.ts

/** JS → Native 訊息型別 */
export type NativeMessage =
  | { kind: "ready" }
  | { kind: "change"; html: string }
  | { kind: "selection"; active: ActiveMarks }
  | { kind: "height"; value: number }
  | { kind: "focus"; focused: boolean };

export interface ActiveMarks {
  heading: 1 | 2 | 3 | null;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

interface WebkitHandler {
  postMessage(msg: unknown): void;
}

// test-only override
let testHandler: WebkitHandler | null = null;
export function setTestHandler(handler: WebkitHandler | null) {
  testHandler = handler;
}

function getHandler(): WebkitHandler | null {
  if (testHandler) return testHandler;
  const w = window as unknown as {
    webkit?: { messageHandlers?: { editor?: WebkitHandler } };
  };
  return w.webkit?.messageHandlers?.editor ?? null;
}

export function postToNative(msg: NativeMessage) {
  const handler = getHandler();
  if (!handler) return;
  handler.postMessage(msg);
}
