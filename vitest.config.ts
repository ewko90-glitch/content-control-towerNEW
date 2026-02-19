import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/lib/domain/controlTowerV3/**/__tests__/**/*.test.ts",
      "src/modules/controlTowerV3/**/__tests__/**/*.test.ts",
    ],
    testTimeout: 10000,
  },
});
