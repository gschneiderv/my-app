/*
  Vite configuration.

  The app has two pages (Screen 1 and the results screen). Vite only builds
  index.html by default, so both pages are listed as build inputs here.
  Without this, `npm run build` would leave out results.html.
*/

import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"), // Screen 1: initialization
        results: resolve(import.meta.dirname, "results.html"), // Screen 2: results
      },
    },
  },
});
