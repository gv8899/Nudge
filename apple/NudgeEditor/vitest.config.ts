import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: { "@web-editor": resolve(__dirname, "../../src/components/editor") },
    // 與 vite.config.ts 相同理由：共用模組的 @tiptap/* 一律從本子專案解析。
    dedupe: ["@tiptap/core", "@tiptap/pm", "@tiptap/extension-image", "@tiptap/extension-link", "@tiptap/starter-kit", "@tiptap/suggestion"],
  },
  test: { environment: "jsdom" },
  // Same rationale as vite.config.ts: the Next.js web app's root
  // postcss.config.mjs requires @tailwindcss/postcss, which isn't
  // installed here. Skip autodiscovery for vitest runs too.
  css: {
    postcss: { plugins: [] },
  },
});
