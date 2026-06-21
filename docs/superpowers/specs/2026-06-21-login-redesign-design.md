# ログイン画面 再設計 — 設計ドキュメント

- 日付: 2026-06-21
- 対象: `src/client/pages/Login.tsx`
- 種別: UI のみの刷新（認証ロジックは現状維持）

## 目的

素朴な中央寄せカードだったログイン画面を、HeroUI v3 を活かしたモダンな
スプリット型レイアウトに刷新する。アプリの世界観（アクセントカラー・DotPattern）
と統一し、第一印象を引き上げる。

## 方向性（決定事項）

- レイアウト: **スプリット型**（PC は左ブランド／右フォームの2カラム、モバイルは1カラム）
- ビジュアル: **アクセントカラー基調**のグラデーション ＋ `DotPattern` オーバーレイ
- モーション: **上品に控えめ**（フェード/スライドの stagger、ボタンの hover lift）

## レイアウト構造

PC（`lg` 以上）: 2カラム grid（左ブランドパネル / 右フォームパネル）。
モバイル（`lg` 未満）: 1カラム。上に圧縮したブランドヘッダー（accent グラデ小バナー）、
その下にフォーム。

### ブランドパネル（左 / モバイルは上ヘッダー）
- 背景: `accent` 系の斜めグラデーション（light/dark 追従）
- `DotPattern` を薄く重ねる（静的 SVG、`pointer-events-none`）
- 控えめな光沢シャイン1本
- ロゴ的アイコン + サービス名「エンジニア給与計算」
- キャッチ「単価連動型の給与を計算・予測・可視化」
- 特徴3点: 推移を可視化 / 来期を予測 / Tech ランク判定

### フォームパネル（右 / モバイルは下）
- 右上に `ThemeToggle`（既存コンポーネント、`useTheme` は `ThemeProvider` 配下で利用可）
- 歓迎コピー（見出し + サブコピー）
- `error` の `Alert`（danger）
- `Button fullWidth`（Google アイコン付き「Google でログイン」）→ `/auth/login` へ遷移
- DEV 時のみ: `Separator` + 開発用ログインボタン + 補足
- プライバシー注記「自分のデータのみ閲覧・編集できます。」

## 機能スコープ（現状維持・変更しない）

- Google ログイン: `window.location.href = "/auth/login"`
- 開発用ログイン: `api.devLogin()` → `api.me()` → `onLoggedIn(user)`
- エラー表示と loading 状態
- `showDevLogin = import.meta.env.DEV` による出し分け
- `onLoggedIn` コールバックのシグネチャ

## モーション（framer-motion・控えめ）

- 右フォーム要素を stagger で軽くフェード + スライドイン（見出し→ボタン→注記）
- ボタンの hover lift（`whileHover` / `whileTap`）
- `prefers-reduced-motion` を尊重し、有効時はアニメーションを無効化
- 新規依存なし（既存の `framer-motion` を利用）

## 実装方針

- `Login.tsx` を1ファイル完結で全面書き換え
- スタイルは Tailwind ユーティリティ中心。グラデ背景のみ既存トークン参照 or inline
- Google ブランドアイコンの SVG をインライン追加
- 既存の `DotPattern` / `ThemeToggle` を再利用

## 非対象（YAGNI）

- 認証フロー・API の変更
- 新規 UI ライブラリ / 依存の追加
- 多言語対応の拡張
