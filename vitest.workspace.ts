import { defineWorkspace } from "vitest/config";

// 2 プロジェクト構成:
// - unit    : 計算ロジック（src/shared）の純粋な Node ユニットテスト
// - workers : Worker API（/api/*）の統合テスト（workerd + D1）
//
// `vitest run` は本ファイルを自動検出し、両プロジェクトをまとめて実行する。
// 個別に流す場合は `vitest run --project unit` / `--project workers`。
export default defineWorkspace([
  "./vitest.config.ts",
  "./vitest.workers.config.ts",
]);
