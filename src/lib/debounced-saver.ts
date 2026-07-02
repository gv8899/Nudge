/**
 * Debounce 儲存 + 可 flush。對齊 Mac CardDetailView 的 flushPendingSave：
 * 關閉/離開畫面時把還沒送出的編輯立即存檔，避免 debounce 窗內的編輯遺失。
 */
export class DebouncedSaver<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { value: T } | null = null;

  constructor(
    private readonly save: (value: T) => void,
    private readonly delayMs = 800,
  ) {}

  schedule(value: T): void {
    this.pending = { value };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending) {
      const { value } = this.pending;
      this.pending = null;
      this.save(value);
    }
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
  }
}
