import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// クライアント（React コンポーネント）の対話テスト用。
// jsdom 環境で HeroUI / React Aria コンポーネントの挙動を検証する。
// 計算ロジックは unit、Worker API は workers プロジェクト側で実行する
// （vitest.workspace.ts が全プロジェクトをまとめる）。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./src/shared"),
    },
  },
  test: {
    name: "client",
    include: ["test-client/**/*.test.tsx"],
    environment: "jsdom",
    globals: true,
  },
});
