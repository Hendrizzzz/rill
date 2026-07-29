import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["parity-tests/monkeytypeSourceOracle.test.ts"],
  },
});
