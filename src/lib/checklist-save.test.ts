import { afterEach, describe, expect, it, vi } from "vitest";
import { saveChecklistEdit } from "./checklist-save";
import { seedCardVersion } from "./card-version";

const UL = (inner: string) => `<ul data-type="taskList">${inner}</ul>`;
const LI = (text: string, checked: boolean) =>
  `<li data-type="taskItem" data-checked="${checked}"><div><p>${text}</p></div></li>`;

function queueFetch(responses: Array<{ status: number; body: Record<string, unknown> }>) {
  let i = 0;
  const fetchMock = vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      json: async () => r.body,
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);
}

afterEach(() => vi.unstubAllGlobals());

describe("saveChecklistEdit", () => {
  it("saves toggled description with baseUpdatedAt", async () => {
    const id = "save-1";
    const html = UL(LI("A", false));
    const fetchMock = queueFetch([
      { status: 200, body: { id, updatedAt: "2026-10-29T00:00:05.000Z" } },
    ]);
    const result = await saveChecklistEdit(
      { id, description: html, updatedAt: "2026-10-29T00:00:00.000Z" },
      { kind: "toggle", index: 0, text: "A", checked: true },
    );
    expect(result).toEqual({
      status: "saved",
      description: UL(LI("A", true)),
      updatedAt: "2026-10-29T00:00:05.000Z",
    });
    const body = bodyOf(fetchMock, 0);
    expect(body.description).toContain('data-checked="true"');
    expect(body.baseUpdatedAt).toBe("2026-10-29T00:00:00.000Z");
  });

  it("rebases once on 409 and resaves", async () => {
    const id = "save-2";
    const html = UL(LI("A", false));
    const latest = UL(LI("A", false) + LI("B", false)); // 另一台多加了 B
    const fetchMock = queueFetch([
      { status: 409, body: { id, updatedAt: "2026-10-29T00:00:09.000Z", description: latest } },
      { status: 200, body: { id, updatedAt: "2026-10-29T00:00:10.000Z" } },
    ]);
    const result = await saveChecklistEdit(
      { id, description: html, updatedAt: "2026-10-29T00:00:00.000Z" },
      { kind: "toggle", index: 0, text: "A", checked: true },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const expected = UL(LI("A", true) + LI("B", false));
    expect(bodyOf(fetchMock, 1).description).toBe(expected);
    expect(result).toEqual({
      status: "saved",
      description: expected,
      updatedAt: "2026-10-29T00:00:10.000Z",
    });
  });

  it("drops when rebase text mismatches", async () => {
    const id = "save-3";
    const html = UL(LI("A", false));
    const latest = UL(LI("A2", false)); // 另一台把第 0 項文字改了
    const fetchMock = queueFetch([
      { status: 409, body: { id, updatedAt: "2026-10-29T00:00:09.000Z", description: latest } },
    ]);
    const result = await saveChecklistEdit(
      { id, description: html, updatedAt: "2026-10-29T00:00:00.000Z" },
      { kind: "toggle", index: 0, text: "A", checked: true },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "dropped", latestDescription: latest });
  });

  it("does not reseed when base already exists", async () => {
    const id = "save-4";
    seedCardVersion(id, "2026-10-29T08:00:00.000Z"); // 詳情編輯器已 seed 的較新基準
    const html = UL(LI("A", false));
    const fetchMock = queueFetch([
      { status: 200, body: { id, updatedAt: "2026-10-29T09:00:00.000Z" } },
    ]);
    await saveChecklistEdit(
      { id, description: html, updatedAt: "2026-10-29T00:00:00.000Z" }, // 過時的 task.updatedAt
      { kind: "toggle", index: 0, text: "A", checked: true },
    );
    expect(bodyOf(fetchMock, 0).baseUpdatedAt).toBe("2026-10-29T08:00:00.000Z");
  });

  it("returns null when local apply fails (no fetch)", async () => {
    const id = "save-5";
    const html = UL(LI("A", false));
    const fetchMock = queueFetch([{ status: 200, body: {} }]);
    const result = await saveChecklistEdit(
      { id, description: html, updatedAt: "2026-10-29T00:00:00.000Z" },
      { kind: "toggle", index: 0, text: "WRONG", checked: true },
    );
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
