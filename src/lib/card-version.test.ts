import { afterEach, describe, expect, it, vi } from "vitest";
import { getCardVersion, isCardSaveInFlight, patchCardField, seedCardVersion } from "./card-version";

function deferredFetch(status: number, body: Record<string, unknown>) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const fetchMock = vi.fn(async () => {
    await gate;
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { release, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isCardSaveInFlight", () => {
  it("200：fetch 在途時為 true，回應處理完為 false（基準已推進）", async () => {
    seedCardVersion("c-ok", "2026-10-17T00:00:00.000Z");
    const { release } = deferredFetch(200, { id: "c-ok", updatedAt: "2026-10-17T00:00:05.000Z" });
    expect(isCardSaveInFlight("c-ok")).toBe(false);
    const p = patchCardField("c-ok", { title: "x" });
    expect(isCardSaveInFlight("c-ok")).toBe(true);
    release();
    const r = await p;
    expect(r.status).toBe("ok");
    expect(isCardSaveInFlight("c-ok")).toBe(false);
    expect(getCardVersion("c-ok")).toBe("2026-10-17T00:00:05.000Z");
  });

  it("409：fetch 在途時為 true，回應處理完為 false（基準改成 server 最新）", async () => {
    seedCardVersion("c-409", "2026-10-17T00:00:00.000Z");
    const { release } = deferredFetch(409, { id: "c-409", updatedAt: "2026-10-17T00:00:09.000Z" });
    const p = patchCardField("c-409", { description: "<p>x</p>" });
    expect(isCardSaveInFlight("c-409")).toBe(true);
    release();
    const r = await p;
    expect(r.status).toBe("conflict");
    expect(isCardSaveInFlight("c-409")).toBe(false);
    expect(getCardVersion("c-409")).toBe("2026-10-17T00:00:09.000Z");
  });

  it("fetch 失敗時也會歸零", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    await expect(patchCardField("c-err", { title: "x" })).rejects.toThrow("net");
    expect(isCardSaveInFlight("c-err")).toBe(false);
  });

  it("同卡兩個並行存檔：都完成才歸零", async () => {
    const a = deferredFetch(200, { updatedAt: "2026-10-17T00:01:00.000Z" });
    const p1 = patchCardField("c-two", { title: "a" });
    const b = deferredFetch(200, { updatedAt: "2026-10-17T00:02:00.000Z" });
    const p2 = patchCardField("c-two", { title: "b" });
    a.release();
    await p1;
    expect(isCardSaveInFlight("c-two")).toBe(true);
    b.release();
    await p2;
    expect(isCardSaveInFlight("c-two")).toBe(false);
  });
});
