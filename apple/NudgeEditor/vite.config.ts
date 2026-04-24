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
