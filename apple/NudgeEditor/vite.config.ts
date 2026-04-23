import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: __dirname,
  base: "./",
  resolve: {
    alias: {
      // 讓 src/main.ts 能 import 既有 web editor extensions
      "@web-editor": resolve(__dirname, "../../src/components/editor"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
      output: {
        // 產生固定檔名，Swift 端 hardcode reference
        entryFileNames: "editor.js",
        chunkFileNames: "editor-[hash].js",
        assetFileNames: (asset) => {
          if (asset.name?.endsWith(".css")) return "editor.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    target: "safari16",
    sourcemap: false,
    minify: "esbuild",
  },
});
