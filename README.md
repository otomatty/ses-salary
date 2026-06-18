# エンジニア給与計算（単価連動型）

SES 企業のエンジニアが、単価連動型の給与体系における自分の給与を、ルールに沿って
**自動計算・予測・可視化**できる社内ツールです。四半期（1〜3 / 4〜6 / 7〜9 / 10〜12月）
ごとの平均単価から「帯（レンジ）」を判定し、評価ランク（1/2/3）と組み合わせて還元率を
決定、`平均単価 × 還元率` で**次の四半期**の給与（総支給）を算出します。
（例: 4〜6月の平均単価 → 7〜9月の給与）

> 本アプリは **額面（総支給）の計算・予測・可視化** に特化しています。
> 支払い業務・手取り計算・勤怠管理・管理者向け機能は対象外です（PRD 準拠）。

## 技術スタック（Cloudflare 最適・軽量構成）

| 領域 | 採用技術 | 理由 |
|---|---|---|
| 実行環境 | **Cloudflare Workers** | エッジ実行・低レイテンシ・低コスト |
| バックエンド | **Hono** | Workers 向けの超軽量 Web フレームワーク |
| フロントエンド | **React 19 + Vite** | SPA。`@cloudflare/vite-plugin` で Workers と統合 |
| データベース | **Cloudflare D1**（SQLite）+ **Drizzle ORM** | Workers ネイティブ・サーバレス |
| スタイル | **Tailwind CSS v4** | 軽量・ビルド時最適化 |
| グラフ | **Recharts** | 推移グラフ |
| 認証 | **Google OAuth 2.0** + 署名付き Cookie セッション | DB セッション不要で軽量・ドメイン制限可 |

計算ロジック（`src/shared/`）はサーバ・クライアントで共有し、計算の透明性
（対象3ヶ月・平均・帯・ランク・率・式）を常に提示します。

## ディレクトリ構成

```
src/
  shared/        計算ロジック（サーバ・クライアント共有）
    rateTable.ts   早見表マスタ（還元率テーブル）
    calc.ts        給与計算の核心ロジック
    periods.ts     年月計算・今期/来期/履歴の組み立て
    types.ts       API 型定義
  worker/        Cloudflare Worker（Hono）
    index.ts       エントリポイント
    auth.ts        Google SSO / 開発用ログイン
    routes/api.ts  認証済み API（/api/*）
    db/            Drizzle スキーマ・D1 クライアント
    lib/           セッション署名・ID 生成
  client/        React SPA
    pages/         ログイン/ホーム/月単価/計算根拠/設定
    components/    UI・グラフ・計算根拠カード
migrations/      D1 マイグレーション（SQL）
test/            計算ロジックのユニットテスト・Worker API の統合テスト（test/worker/）
```

## セットアップ

### 1. 依存関係のインストール

```bash
bun install
```

### 2. D1 データベースの作成

```bash
bunx wrangler d1 create ses-salary-db
```

出力された `database_id` を `wrangler.jsonc` の
`d1_databases[0].database_id` に貼り付けます。

### 3. マイグレーション適用

```bash
# ローカル
bun run db:migrate:local
# 本番（D1 リモート）
bun run db:migrate:remote
```

### 4. 開発用シークレット

```bash
cp .dev.vars.example .dev.vars
# SESSION_SECRET などを適宜編集
```

### 5. ローカル開発サーバ

```bash
bun run dev
```

ログイン画面の「**開発用ログイン**」ボタンで認証をスキップして動作確認できます
（`wrangler.jsonc` の `DEV_AUTH: "true"` のとき有効。本番ビルドでは非表示）。

### 6. テスト

```bash
bun run test           # 全テスト（unit + workers）
bun run test:unit      # 計算ロジック（src/shared）のみ・Node 環境
bun run test:workers   # Worker API 統合テストのみ・workerd + D1
```

- **unit**: `src/shared` の給与計算・境界値テスト。Cloudflare 非依存で高速。
- **workers**: `/api/*`・`/auth/*` を実コードのまま workerd 上で実行し、
  miniflare のローカル D1 にマイグレーションを適用してエンドツーエンドで検証する
  （`@cloudflare/vitest-pool-workers`）。

CI（`.github/workflows/ci.yml`）は PR ごとに `typecheck → test → build` を実行する。

## Google SSO（本番）の設定

1. Google Cloud Console で OAuth 2.0 クライアント（種別: ウェブ）を作成。
2. 承認済みリダイレクト URI に `https://<your-app>.workers.dev/auth/callback` を追加。
3. シークレットを登録:

   ```bash
   bunx wrangler secret put GOOGLE_CLIENT_ID
   bunx wrangler secret put GOOGLE_CLIENT_SECRET
   bunx wrangler secret put SESSION_SECRET
   ```

4. `wrangler.jsonc` の `vars` を設定:
   - `APP_URL`: 本番 URL（例 `https://ses-salary.<account>.workers.dev`）
   - `ALLOWED_EMAIL_DOMAIN`: 会社ドメイン（例 `example.co.jp`）。空なら無制限。
   - `DEV_AUTH`: 本番は `"false"` にする。

## デプロイ

```bash
bun run deploy
```

## 計算仕様（要点）

- 四半期（1〜3 / 4〜6 / 7〜9 / 10〜12月）の月単価の**単純平均**（四捨五入）から帯（A〜M）を判定し、
  **その平均を次の四半期の給与の基準**にする（例: 4〜6月の平均 → 7〜9月の給与）。
- 帯 × 評価ランク（1/2/3）で**還元率**を決定し、`給与 = round(平均単価 × 還元率)`。
- **140万円以上**: `要相談`（自動計算対象外）。
- **40万円未満**: 一律 **235,000円**（固定額）。
- **A-0 / A-1**（40〜50万円）: 評価ランク不問の**単一レート**。
- **デビュー特例（四半期途中の入社・エンジニアデビュー）**: 基準となる四半期の
  途中（第2月・第3月）でデビューし、その四半期に案件単価が3ヶ月分そろわない場合は、
  還元率方式ではなく一律 **235,000円**（`status: "debut"`）を適用する。
  単価が3ヶ月分そろう最初の四半期から通常の還元率方式へ自動的に切り替わる
  （資料「四半期の途中でデビューした場合」準拠）。デビュー四半期は、各ユーザーの
  **最古の月単価**から推定する（単価が月初より後に付き、そこから四半期末まで連続している
  場合をデビューとみなす。単なる入力漏れ・歯抜けは「入力待ち」として算出しない）。

### 単価入力 UI

- 月単価は **万円単位**で入力する（例: `80` → 80万円 = 800,000円）。保存時に円へ変換する。
- **一括入力**: 連続した月（開始年月〜終了年月）に同じ単価をまとめて登録できる
  （例: 4〜6月をすべて 80万円）。単価が据え置きの期間を一度に入力する用途。
  API は `POST /api/prices/bulk`（1件でも不正なら全体を保存しない原子的 upsert）。
- 早見表は会社共通の固定マスタ（`src/shared/rateTable.ts`）。改定時はここを更新。
  低単価帯で率が単調増加しない点は早見表どおり意図的に採用。

### 仕様上の決定（PRD §12 の未決事項について）

- **端数処理**: `平均単価 × 還元率` は **四捨五入**（円単位）。平均単価も四捨五入。
  運用変更時は `src/shared/calc.ts` の `Math.round` を調整。
- **対象期間の起点**: 暦の四半期（1〜3 / 4〜6 / 7〜9 / 10〜12月）。各給与は「適用四半期の
  開始月」でラベル付けし、その**直前の四半期**の3ヶ月から算出。
- **評価ランク未設定時**: ランク 1 を暫定適用（設定画面で変更可能）。
- **要相談・固定額の案内（§12.4）**: 「なぜ自動計算されないか（理由）」と
  「次に何をすべきか（行動）」を `src/shared/guidance.ts` に集約し、ホーム・
  計算根拠・推移グラフで一貫表示する。要相談の期は推移グラフで給与線を繋がず
  欠損として扱い、別系列のマーカーで明示する。相談窓口名・連絡先は
  `SALARY_CONTACT` を運用に合わせて編集する（最終文言は要確認）。

## 給与計算結果のスナップショット

`salary_results` テーブルを用意していますが、MVP では表示をオンザフライ計算で
行っています。監査・追跡用にスナップショットを保存する拡張に対応できる構造です。
