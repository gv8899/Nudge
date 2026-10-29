import { describe, it, expect } from "vitest";
import cases from "./checklist-cases.json";
import {
  parseChecklist,
  applyChecklistEdit,
  checklistTransition,
  type ChecklistEdit,
} from "./checklist";

// Fixture `checklist-cases.json` 由 TS 與 Swift（ChecklistHTMLTests）共吃。

describe("parseChecklist", () => {
  it.each(cases.parse)("$name", (c) => {
    expect(parseChecklist(c.html)).toEqual(c.items);
  });
});

describe("applyChecklistEdit", () => {
  it.each(cases.edit)("$name", (c) => {
    expect(applyChecklistEdit(c.html, c.edit as ChecklistEdit)).toBe(c.expected);
  });
});

describe("checklistTransition", () => {
  it.each(cases.transition)("$name", (c) => {
    expect(checklistTransition(c.before, c.after)).toBe(c.expected);
  });
});
