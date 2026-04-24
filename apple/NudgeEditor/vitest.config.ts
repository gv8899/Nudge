import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "jsdom" },
  // Same rationale as vite.config.ts: the Next.js web app's root
  // postcss.config.mjs requires @tailwindcss/postcss, which isn't
  // installed here. Skip autodiscovery for vitest runs too.
  css: {
    postcss: { plugins: [] },
  },
});
