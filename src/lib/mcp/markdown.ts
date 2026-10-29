// AI 服務寫進卡片的內容用 Markdown 傳進來，這裡轉成 Nudge 編輯器（tiptap）
// 認得的 HTML。編輯器不認得的結構會在載入時被丟掉，所以：
// - 待辦清單 → tiptap taskList / taskItem 格式（混合清單的勾選框改成 ☐ / ☑ 文字）
// - 表格（編輯器沒有表格）→ 每列一個項目符號，欄位用 " | " 連接
// - 原始 HTML 一律跳脫成文字（AI 可能從網頁抓到惡意片段）

import { Marked, type Tokens } from "marked";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const md = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    // 混合清單（一般項目 + 待辦項目）走預設渲染；編輯器不認 <input>，勾選框改成文字符號。
    checkbox({ checked }: Tokens.Checkbox) {
      return checked ? "☑ " : "☐ ";
    },
    list(token: Tokens.List) {
      const isTaskList = token.items.length > 0 && token.items.every((i) => i.task);
      if (!isTaskList) return false; // 走預設
      const items = token.items
        .map((item) => {
          const inner = this.parser.parse(
            item.tokens.filter((t) => t.type !== "checkbox"),
          );
          const body = /^\s*<(p|ul|ol|h\d|pre|blockquote)/.test(inner) ? inner : `<p>${inner}</p>`;
          return `<li data-type="taskItem" data-checked="${item.checked ? "true" : "false"}">${body}</li>`;
        })
        .join("");
      return `<ul data-type="taskList">${items}</ul>\n`;
    },
    table(token: Tokens.Table) {
      const cell = (c: Tokens.TableCell) => this.parser.parseInline(c.tokens);
      const rows = [token.header, ...token.rows]
        .map((r) => `<li><p>${r.map(cell).join(" | ")}</p></li>`)
        .join("");
      return `<ul>${rows}</ul>\n`;
    },
    link({ href, title, tokens }: Tokens.Link) {
      const text = this.parser.parseInline(tokens);
      if (!/^(https?:|mailto:)/i.test(href)) return text;
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(href)}"${t}>${text}</a>`;
    },
    image({ href, text }: Tokens.Image) {
      // 只接受 Nudge 自己的附件網址；外部圖片改成連結（不替使用者下載別人的圖）。
      if (/^\/api\/attachments\/[\w-]+$/.test(href)) {
        const id = href.split("/").pop();
        return `<img src="${href}" data-attachment-id="${id}" alt="${escapeHtml(text)}">`;
      }
      if (/^https?:/i.test(href)) {
        return `<a href="${escapeHtml(href)}">${escapeHtml(text || href)}</a>`;
      }
      return escapeHtml(text);
    },
  },
});

export function markdownToHtml(markdown: string): string {
  return (md.parse(markdown, { async: false }) as string).trim();
}
