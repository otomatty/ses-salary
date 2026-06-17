import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// 計算ロジック（src/shared）のユニットテスト用。
// Cloudflare プラグインは読み込まず、純粋な Node 環境で実行する。
export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./src/shared"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
