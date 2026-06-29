# CLAUDE.md

プロジェクトのルール・仕様は `AGENTS.md` と `README.md` を参照すること。ここでは特に重要なルールのみ明記する。

## パッケージマネージャ

このプロジェクトのパッケージマネージャは **Bun** を使用する（`packageManager: bun@1.3.x`）。`npm` / `yarn` / `pnpm` は使用しない。

- 依存関係のインストールは `bun install`（`npm install` は使わない）。
- スクリプト実行は `bun run <script>`（例: `bun run dev` / `bun run build` / `bun run typecheck` / `bun run test`）。
- ロックファイルは `bun.lock` のみをコミットする。`package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` は生成・コミットしない（`.gitignore` 済み）。
