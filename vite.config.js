/*
  Vite configuration.

  The app has three pages (Screen 1, the results screen and the invalid input
  warning). Vite only builds index.html by default, so every page is listed as
  a build input here. Without this, `npm run build` would leave the others out.
*/

import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"), // Screen 1: initialization
        results: resolve(import.meta.dirname, "results.html"), // Screen 2: results
        invalid: resolve(import.meta.dirname, "invalid.html"), // Invalid input warning
      },
    },
  },
});
