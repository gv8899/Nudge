import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DebouncedSaver } from "./debounced-saver";

describe("DebouncedSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("延遲後只存最後一次的值", () => {
    const save = vi.fn();
    const saver = new DebouncedSaver<string>(save, 800);
    saver.schedule("a");
    saver.schedule("b");
    vi.advanceTimersByTime(799);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("b");
  });

  it("flush 立即存 pending 值，且 timer 不會再觸發", () => {
    const save = vi.fn();
    const saver = new DebouncedSaver<string>(save, 800);
    saver.schedule("a");
    saver.flush();
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("a");
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledOnce(); // 不重複
  });

  it("沒有 pending 時 flush 是 no-op", () => {
    const save = vi.fn();
    new DebouncedSaver<string>(save, 800).flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("cancel 丟棄 pending", () => {
    const save = vi.fn();
    const saver = new DebouncedSaver<string>(save, 800);
    saver.schedule("a");
    saver.cancel();
    vi.advanceTimersByTime(2000);
    saver.flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("isPending 反映 schedule / flush / cancel", () => {
    const saved: string[] = [];
    const s = new DebouncedSaver<string>((v) => saved.push(v), 100);
    expect(s.isPending()).toBe(false);
    s.schedule("a");
    expect(s.isPending()).toBe(true);
    s.flush();
    expect(s.isPending()).toBe(false);
    s.schedule("b");
    s.cancel();
    expect(s.isPending()).toBe(false);
  });
});
