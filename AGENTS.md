# AGENTS.md

SES エンジニア向け 単価連動型 給与計算アプリ。Cloudflare Workers (Hono) + React 19/Vite + D1 (Drizzle ORM)。詳細な仕様・コマンドは `README.md` を参照。

## Cursor Cloud specific instructions

- Package manager is **Bun** (`packageManager: bun@1.3.x`). Standard scripts live in `package.json` (`dev`, `build`, `typecheck`, `test`, `db:migrate:local`). Use those instead of duplicating commands.
- Local secrets: copy `.dev.vars.example` to `.dev.vars` (gitignored). For dev, `SESSION_SECRET` can stay as the placeholder and Google OAuth vars can stay empty — `DEV_AUTH: "true"` in `wrangler.jsonc` enables the **開発用ログイン** button which logs in as `dev@example.com` and bypasses Google OAuth.
- Local D1: `wrangler.jsonc` has a placeholder `database_id` (`REPLACE_WITH_YOUR_D1_DATABASE_ID`). This is fine for local dev — `bun run db:migrate:local` uses miniflare's local SQLite under `.wrangler/state` and ignores the id. A real id is only needed for `--remote`/deploy. Re-run `bun run db:migrate:local` after a fresh checkout to recreate the local DB (it is gitignored).
- Dev server: `bun run dev` runs Vite with the `@cloudflare/vite-plugin`, serving both the worker API and the SPA on `http://localhost:5173`. There is no separate backend process.
- Tests (`bun run test` / vitest) cover only the shared calculation logic in `src/shared` and run in a plain Node environment (no Cloudflare plugin), so they do not require the dev server or D1.
- `bun run build` produces both an SSR worker bundle and the client SPA; the large client chunk size warning is expected and not an error.
