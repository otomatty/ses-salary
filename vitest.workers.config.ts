import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";
import { resolve } from "node:path";

// Worker API（/api/*・/auth/*）の統合テスト用。
//
// 実コードを workerd ランタイム上で動かし、D1（miniflare のローカル SQLite）に
// 本番と同じマイグレーションを適用してエンドツーエンドで検証する。
// マイグレーションはバインディング（TEST_MIGRATIONS）経由でテストへ渡し、
// 各テストファイルの setup（test/worker/apply-migrations.ts）で適用する。
export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(resolve(__dirname, "migrations"));

  return {
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "./src/shared"),
      },
    },
    test: {
      name: "workers",
      include: ["test/worker/**/*.test.ts"],
      setupFiles: ["./test/worker/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          // テストごとにストレージを分離し、状態の漏れを防ぐ。
          isolatedStorage: true,
          miniflare: {
            compatibilityDate: "2024-12-30",
            compatibilityFlags: ["nodejs_compat"],
            d1Databases: ["DB"],
            bindings: {
              // setup でマイグレーションを適用するために渡す。
              TEST_MIGRATIONS: migrations,
              // 本番 env と同じ vars。DEV_AUTH=true で /auth/dev-login を有効化する。
              DEV_AUTH: "true",
              ALLOWED_EMAIL_DOMAIN: "",
              APP_URL: "http://localhost:5173",
              SESSION_SECRET: "test-session-secret",
            },
          },
        },
      },
    },
  };
});
