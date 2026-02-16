import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.integration.ts", "tests/**/*.test.integration.ts"],
    testTimeout: 120_000,
    env: {
      BETTER_AUTH_SILENT: "true",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
