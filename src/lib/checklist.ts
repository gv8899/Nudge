// 任務內文（tasks.description HTML）裡的待辦項目 = 任務列上的「子項目」。
// 純字串掃描，不用 DOMParser —— 要能在 server / vitest 跑，也要讓 Swift 端
// 逐字鏡像（NudgeCore/ChecklistHTML.swift）。**改這裡，兩邊測試都要過。**
//
// 內文待辦有兩種真實長相，解析與改寫都要吃：
//   編輯器吐的：  <li data-checked="true" data-type="taskItem"><label><input
//                 type="checkbox" checked="checked"><span></span></label>
//                 <div><p>文字</p></div></li>
//   手寫/onboarding：<li data-type="taskItem" data-checked="false">
//                 <div><p>文字</p></div></li>   （沒有 <label><input>、屬性順序相反）
// 所以：屬性順序無關；<input> 可有可無；改勾選時 data-checked 一定改，有 input
// 才連 checked="checked" 一起改。普通 <li>（非 taskItem）一律忽略。

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export type ChecklistEdit =
  | { kind: "toggle"; index: number; text: string; checked: boolean }
  | { kind: "append"; text: string }
  | { kind: "checkAll" };

export type ChecklistTransition =
  | "became-all-checked"
  | "left-all-checked"
  | "none";

// 一個 taskItem <li>…</li> 區塊。nested:false 保證 taskItem 不會互相巢狀，
// 所以非貪婪抓到第一個 </li> 即為該項結尾。
const LI_BLOCK = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;

function isTaskItem(openAttrs: string): boolean {
  return /\bdata-type="taskItem"/i.test(openAttrs);
}

function isChecked(openAttrs: string): boolean {
  return /\bdata-checked="true"/i.test(openAttrs);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&"); // 最後解 &amp;，避免把 &amp;lt; 變成 <
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 取 taskItem 內的純文字：先拿掉 checkbox 的 <label>…</label>，再去掉所有
// 標籤、解碼實體、trim。
function itemText(inner: string): string {
  const noLabel = inner.replace(/<label\b[^>]*>[\s\S]*?<\/label>/gi, "");
  const noTags = noLabel.replace(/<[^>]+>/g, "");
  return decodeEntities(noTags).trim();
}

interface Block {
  start: number; // <li 的位置
  end: number; // </li> 之後
  open: string; // 開標籤屬性
  inner: string; // <li> 與 </li> 之間
  full: string; // 整段 <li>…</li>
}

function taskItemBlocks(html: string): Block[] {
  const out: Block[] = [];
  LI_BLOCK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LI_BLOCK.exec(html)) !== null) {
    if (!isTaskItem(m[1])) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      open: m[1],
      inner: m[2],
      full: m[0],
    });
  }
  return out;
}

export function parseChecklist(html: string | null | undefined): ChecklistItem[] {
  if (!html) return [];
  return taskItemBlocks(html).map((b) => ({
    text: itemText(b.inner),
    checked: isChecked(b.open),
  }));
}

export function isAllChecked(items: ChecklistItem[]): boolean {
  return items.length > 0 && items.every((i) => i.checked);
}

function checkedCount(items: ChecklistItem[]): number {
  return items.filter((i) => i.checked).length;
}

// 把單一 <li>…</li> 區塊改成目標勾選狀態（data-checked + 有 input 才改 input）。
function setBlockChecked(full: string, checked: boolean): string {
  let out = full.replace(
    /(\bdata-checked=")(?:true|false)(")/i,
    `$1${checked ? "true" : "false"}$2`,
  );
  if (/<input\b[^>]*type="checkbox"/i.test(out)) {
    if (checked) {
      if (!/<input\b[^>]*\bchecked=/i.test(out)) {
        out = out.replace(
          /(<input\b[^>]*type="checkbox")([^>]*>)/i,
          `$1 checked="checked"$2`,
        );
      }
    } else {
      out = out.replace(
        /(<input\b[^>]*type="checkbox")\s+checked="checked"([^>]*>)/i,
        `$1$2`,
      );
    }
  }
  return out;
}

// 新增項目用編輯器一致的 HTML（有 label/input），下次編輯器載入不會多 diff。
function newItemHtml(text: string): string {
  return `<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>${escapeHtml(
    text,
  )}</p></div></li>`;
}

export function applyChecklistEdit(
  html: string | null | undefined,
  edit: ChecklistEdit,
): string | null {
  const src = html ?? "";

  if (edit.kind === "append") {
    const text = edit.text.trim();
    if (!text) return null;
    const li = newItemHtml(text);
    const blocks = taskItemBlocks(src);
    if (blocks.length === 0) {
      return `${src}<ul data-type="taskList">${li}</ul>`;
    }
    const last = blocks[blocks.length - 1];
    return src.slice(0, last.end) + li + src.slice(last.end);
  }

  if (edit.kind === "checkAll") {
    const blocks = taskItemBlocks(src);
    if (blocks.length === 0) return src;
    // 從後往前改，才不會讓前面算好的位移失效。
    let out = src;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (isChecked(b.open)) continue;
      out = out.slice(0, b.start) + setBlockChecked(b.full, true) + out.slice(b.end);
    }
    return out;
  }

  // toggle
  const blocks = taskItemBlocks(src);
  if (edit.index < 0 || edit.index >= blocks.length) return null;
  const b = blocks[edit.index];
  if (itemText(b.inner) !== edit.text) return null;
  if (isChecked(b.open) === edit.checked) return src; // 已是目標狀態
  const replaced = setBlockChecked(b.full, edit.checked);
  return src.slice(0, b.start) + replaced + src.slice(b.end);
}

export function checklistTransition(
  beforeHtml: string | null | undefined,
  afterHtml: string | null | undefined,
): ChecklistTransition {
  const before = parseChecklist(beforeHtml);
  const after = parseChecklist(afterHtml);
  const beforeAll = isAllChecked(before);
  const afterAll = isAllChecked(after);
  if (!beforeAll && afterAll) return "became-all-checked";
  if (beforeAll && !afterAll && checkedCount(after) < checkedCount(before)) {
    return "left-all-checked";
  }
  return "none";
}
