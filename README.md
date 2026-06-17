# SES エンジニア向け 単価連動型 給与計算アプリ

SES 企業のエンジニアが、単価連動型の給与体系における自分の給与を、ルールに沿って
**自動計算・予測・可視化**できる社内ツールです。直近3ヶ月の平均単価から「帯（レンジ）」を
判定し、評価ランク（1/2/3）と組み合わせて還元率を決定、`平均単価 × 還元率` で
次の3ヶ月の給与（総支給）を算出します。

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
test/            計算ロジックのユニットテスト
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. D1 データベースの作成

```bash
npx wrangler d1 create ses-salary-db
```

出力された `database_id` を `wrangler.jsonc` の
`d1_databases[0].database_id` に貼り付けます。

### 3. マイグレーション適用

```bash
# ローカル
npm run db:migrate:local
# 本番（D1 リモート）
npm run db:migrate:remote
```

### 4. 開発用シークレット

```bash
cp .dev.vars.example .dev.vars
# SESSION_SECRET などを適宜編集
```

### 5. ローカル開発サーバ

```bash
npm run dev
```

ログイン画面の「**開発用ログイン**」ボタンで認証をスキップして動作確認できます
（`wrangler.jsonc` の `DEV_AUTH: "true"` のとき有効。本番ビルドでは非表示）。

### 6. テスト

```bash
npm test
```

## Google SSO（本番）の設定

1. Google Cloud Console で OAuth 2.0 クライアント（種別: ウェブ）を作成。
2. 承認済みリダイレクト URI に `https://<your-app>.workers.dev/auth/callback` を追加。
3. シークレットを登録:

   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET
   ```

4. `wrangler.jsonc` の `vars` を設定:
   - `APP_URL`: 本番 URL（例 `https://ses-salary.<account>.workers.dev`）
   - `ALLOWED_EMAIL_DOMAIN`: 会社ドメイン（例 `example.co.jp`）。空なら無制限。
   - `DEV_AUTH`: 本番は `"false"` にする。

## デプロイ

```bash
npm run deploy
```

## 計算仕様（要点）

- 直近3ヶ月の月単価の**単純平均**（四捨五入）から帯（A〜M）を判定。
- 帯 × 評価ランク（1/2/3）で**還元率**を決定し、`給与 = round(平均単価 × 還元率)`。
- **140万円以上**: `要相談`（自動計算対象外）。
- **40万円未満**: 一律 **235,000円**（固定額）。
- **A-0 / A-1**（40〜50万円）: 評価ランク不問の**単一レート**。
- 早見表は会社共通の固定マスタ（`src/shared/rateTable.ts`）。改定時はここを更新。
  低単価帯で率が単調増加しない点は早見表どおり意図的に採用。

### 仕様上の決定（PRD §12 の未決事項について）

- **端数処理**: `平均単価 × 還元率` は **四捨五入**（円単位）。平均単価も四捨五入。
  運用変更時は `src/shared/calc.ts` の `Math.round` を調整。
- **対象3ヶ月の起点**: 暦月ベースのローリング3ヶ月。各給与は「適用開始月」で
  ラベル付けし、その直前3ヶ月から算出。
- **評価ランク未設定時**: ランク 2 を暫定適用（設定画面で変更可能）。

## 給与計算結果のスナップショット

`salary_results` テーブルを用意していますが、MVP では表示をオンザフライ計算で
行っています。監査・追跡用にスナップショットを保存する拡張に対応できる構造です。
