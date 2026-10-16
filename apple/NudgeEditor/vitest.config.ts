import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: { "@web-editor": resolve(__dirname, "../../src/components/editor") },
  },
  test: { environment: "jsdom" },
  // Same rationale as vite.config.ts: the Next.js web app's root
  // postcss.config.mjs requires @tailwindcss/postcss, which isn't
  // installed here. Skip autodiscovery for vitest runs too.
  css: {
    postcss: { plugins: [] },
  },
});
