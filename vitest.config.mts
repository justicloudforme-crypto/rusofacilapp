import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // e2e/ holds Playwright specs, which use a different `test` global and
    // must never be picked up by Vitest's collector.
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      // Next.js only resolves the bare "server-only" import inside its own
      // bundler — see vitest.stubs/server-only.ts for why Vitest needs its
      // own stand-in.
      "server-only": path.resolve(dirname, "./vitest.stubs/server-only.ts"),
    },
  },
});
