import type { Env } from "../../src/worker/env";

// `cloudflare:test` の env をプロジェクトのバインディング型で補強する。
declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    /** apply-migrations.ts で適用する D1 マイグレーション一覧。 */
    TEST_MIGRATIONS: D1Migration[];
  }
}
