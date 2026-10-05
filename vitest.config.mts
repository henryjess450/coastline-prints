import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@config": path.resolve(import.meta.dirname, "config"),
      "@": path.resolve(import.meta.dirname, "src"),
      // server-only throws outside React Server Components; tests are plain Node.
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/empty.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/helpers/global-setup.ts"],
    // Tests never touch the dev database or real storage.
    env: { DATABASE_URL: "file:./test.db", STORAGE_DIR: "./storage-test", OWNER_EMAIL: "owner@coastline.test", PICKUP_ADDRESS: "123 Example Street", APP_URL: "https://coastline.test" },
    fileParallelism: false,
  },
});
