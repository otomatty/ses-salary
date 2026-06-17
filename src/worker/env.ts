/** Worker のバインディング・環境変数の型 */
export interface Env {
  /** D1 データベース */
  DB: D1Database;
  /** 静的アセット（SPA） */
  ASSETS: Fetcher;

  // --- vars (wrangler.jsonc) ---
  /** 許可するメールドメイン（例: "example.co.jp"）。空なら制限しない */
  ALLOWED_EMAIL_DOMAIN: string;
  /** アプリの公開URL（OAuth redirect_uri の組み立てに使用） */
  APP_URL: string;
  /** "true" のときローカル開発用の簡易ログインを有効化する */
  DEV_AUTH: string;

  // --- secrets (wrangler secret put) ---
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** セッションCookieの署名鍵 */
  SESSION_SECRET?: string;
}
