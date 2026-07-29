import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const fingerprintRoots = [
  "index.html",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "public",
  "src",
] as const;

function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return [path];
  }
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => sourceFiles(resolve(path, entry.name)))
    .sort();
}

function sourceFingerprint(): string {
  const root = process.cwd();
  const hash = createHash("sha256");
  for (const file of fingerprintRoots
    .flatMap((path) => sourceFiles(resolve(root, path)))
    .sort()) {
    hash.update(relative(root, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

const buildId =
  process.env.RILL_BUILD_ID ?? `source-${sourceFingerprint().slice(0, 16)}`;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "rill-build-identity",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "build.json",
          source: `${JSON.stringify({ buildId })}\n`,
        });
      },
    },
  ],
  define: {
    __RILL_BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    assetsInlineLimit: 0,
    sourcemap: false,
    reportCompressedSize: true,
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/test/**"],
      thresholds: {
        perFile: true,
        "src/api/{client,pendingResults}.ts": {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 70,
        },
        "src/features/typing/{inputAdapter,prompt,reducer,scoring,storage}.ts": {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 70,
        },
      },
    },
  },
});
