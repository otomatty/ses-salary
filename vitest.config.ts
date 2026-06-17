import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// 計算ロジック（src/shared）のユニットテスト用。
// Cloudflare プラグインは読み込まず、純粋な Node 環境で実行する。
// Worker API の統合テストは vitest.workers.config.ts 側で別プロジェクトとして実行する
// （vitest.workspace.ts が両者をまとめる）。
export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./src/shared"),
    },
  },
  test: {
    name: "unit",
    // 直下の *.test.ts のみ。worker 統合テスト（test/worker/**）は含めない。
    include: ["test/*.test.ts"],
    environment: "node",
  },
});
