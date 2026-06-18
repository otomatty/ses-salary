import { defineWorkspace } from "vitest/config";

// 3 プロジェクト構成:
// - unit    : 計算ロジック（src/shared）の純粋な Node ユニットテスト
// - workers : Worker API（/api/*）の統合テスト（workerd + D1）
// - client  : React コンポーネントの対話テスト（jsdom）
//
// `vitest run` は本ファイルを自動検出し、全プロジェクトをまとめて実行する。
// 個別に流す場合は `vitest run --project unit` / `--project workers` / `--project client`。
export default defineWorkspace([
  "./vitest.config.ts",
  "./vitest.workers.config.ts",
  "./vitest.client.config.ts",
]);
