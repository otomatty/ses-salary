import { applyD1Migrations, env } from "cloudflare:test";

// 各テストファイルの分離ストレージに、本番と同じスキーマを用意する。
// TEST_MIGRATIONS は vitest.workers.config.ts でバインドした migrations/ の内容。
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
