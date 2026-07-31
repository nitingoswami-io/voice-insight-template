import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Node by default; component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock so pure logic tests stay fast.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
