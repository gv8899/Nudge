import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: __dirname,
  base: "./",
  resolve: {
    alias: {
      "@web-editor": resolve(__dirname, "../../src/components/editor"),
    },
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
