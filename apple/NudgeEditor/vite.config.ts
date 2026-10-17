import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: __dirname,
  base: "./",
  resolve: {
    alias: {
      "@web-editor": resolve(__dirname, "../../src/components/editor"),
    },
    // 共用模組（@web-editor）位於 repo 根目錄之下，Node 解析會往上找到根目錄的
    // node_modules；CI 只在 apple/NudgeEditor `npm ci`，根目錄沒有套件 → 解析失敗。
    // dedupe 強制這些套件一律從本子專案的 node_modules 解析（同時保證 @tiptap/core
    // 只有一份，README「版本必須完全一致」的前提）。
    dedupe: ["@tiptap/core", "@tiptap/pm", "@tiptap/extension-image", "@tiptap/extension-link", "@tiptap/starter-kit", "@tiptap/suggestion"],
  },
  // Vite walks up the directory tree looking for postcss.config.* and would
  // find the Next.js web app's config at the repo root, which requires
  // @tailwindcss/postcss. That plugin lives in the web's node_modules, not
  // ours — on CI (which only `npm ci` inside apple/NudgeEditor) it can't be
  // resolved and the build dies. The editor bundle uses plain CSS with
  // custom properties only, so inline plugins:[] both skips auto-discovery
  // and declares we want no PostCSS transforms.
  css: {
    postcss: { plugins: [] },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Classic IIFE bundle so it can be loaded via a plain `<script>` from a
    // file:// page. WKWebView rejects `<script type="module">` on file URLs.
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "NudgeEditorBundle",
      formats: ["iife"],
      fileName: () => "editor.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: (asset) => {
          if (asset.name?.endsWith(".css")) return "editor.css";
          return "assets/[name]-[hash][extname]";
        },
        inlineDynamicImports: true,
      },
    },
    target: "safari16",
    sourcemap: false,
    minify: "esbuild",
  },
});
