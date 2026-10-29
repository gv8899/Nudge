import { afterEach, describe, expect, it, vi } from "vitest";
import { isChecklistCollapsed, setChecklistCollapsed } from "./checklist-collapse";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => m.clear(),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("checklist-collapse", () => {
  it("defaults to expanded", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    expect(isChecklistCollapsed("t1")).toBe(false);
  });

  it("round-trips collapsed state", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    setChecklistCollapsed("t1", true);
    expect(isChecklistCollapsed("t1")).toBe(true);
    expect(isChecklistCollapsed("t2")).toBe(false);
    setChecklistCollapsed("t1", false);
    expect(isChecklistCollapsed("t1")).toBe(false);
  });

  it("survives localStorage throwing", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(isChecklistCollapsed("t1")).toBe(false);
    expect(() => setChecklistCollapsed("t1", true)).not.toThrow();
  });
});
