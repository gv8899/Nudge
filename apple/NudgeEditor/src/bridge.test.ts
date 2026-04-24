// apple/NudgeEditor/src/bridge.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { postToNative, setTestHandler } from "./bridge";

describe("bridge.postToNative", () => {
  beforeEach(() => {
    setTestHandler(null);
  });

  it("no-ops when no webkit handler is present", () => {
    // 預期不丟錯
    expect(() => postToNative({ kind: "ready" })).not.toThrow();
  });

  it("forwards payload to webkit handler when present", () => {
    const spy = vi.fn();
    setTestHandler({ postMessage: spy });
    postToNative({ kind: "change", html: "<p>hi</p>" });
    expect(spy).toHaveBeenCalledWith({ kind: "change", html: "<p>hi</p>" });
  });
});
