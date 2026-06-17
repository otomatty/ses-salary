# AGENTS.md

SES エンジニア向け 単価連動型 給与計算アプリ。Cloudflare Workers (Hono) + React 19/Vite + D1 (Drizzle ORM)。詳細な仕様・コマンドは `README.md` を参照。

## Cursor Cloud specific instructions

- Package manager is **Bun** (`packageManager: bun@1.3.x`). Standard scripts live in `package.json` (`dev`, `build`, `typecheck`, `test`, `db:migrate:local`). Use those instead of duplicating commands.
- Local secrets: copy `.dev.vars.example` to `.dev.vars` (gitignored). For dev, `SESSION_SECRET` can stay as the placeholder and Google OAuth vars can stay empty — `DEV_AUTH: "true"` in `wrangler.jsonc` enables the **開発用ログイン** button which logs in as `dev@example.com` and bypasses Google OAuth.
- Local D1: `wrangler.jsonc` has a placeholder `database_id` (`REPLACE_WITH_YOUR_D1_DATABASE_ID`). This is fine for local dev — `bun run db:migrate:local` uses miniflare's local SQLite under `.wrangler/state` and ignores the id. A real id is only needed for `--remote`/deploy. Re-run `bun run db:migrate:local` after a fresh checkout to recreate the local DB (it is gitignored).
- Dev server: `bun run dev` runs Vite with the `@cloudflare/vite-plugin`, serving both the worker API and the SPA on `http://localhost:5173`. There is no separate backend process.
- Tests (`bun run test` / vitest) run two projects via `vitest.workspace.ts`: **unit** (`test/*.test.ts`) covers the shared calculation logic in `src/shared` in a plain Node environment, and **workers** (`test/worker/**`) runs the Worker API (`/api/*`, `/auth/*`) end-to-end on workerd with a local D1 via `@cloudflare/vitest-pool-workers` (migrations are applied in `test/worker/apply-migrations.ts`). Filter with `bun run test:unit` / `bun run test:workers`. No dev server is required.
- `bun run build` produces both an SSR worker bundle and the client SPA. The recharts chart is code-split via `React.lazy` (`src/client/components/LazyTrendChart.tsx`) so it loads as a separate chunk and is kept out of the initial JS bundle.
