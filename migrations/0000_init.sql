-- SES 給与計算アプリ 初期スキーマ
-- D1 (SQLite) 向け。`wrangler d1 migrations apply ses-salary-db` で適用する。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS monthly_prices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_prices_user_month_unique
  ON monthly_prices (user_id, year_month);

CREATE TABLE IF NOT EXISTS rank_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  rank INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS rank_history_user_effective_unique
  ON rank_history (user_id, effective_from);

CREATE TABLE IF NOT EXISTS salary_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applied_from TEXT NOT NULL,
  avg_unit_price INTEGER NOT NULL,
  applied_band TEXT NOT NULL,
  applied_rank INTEGER NOT NULL,
  applied_rate REAL,
  salary INTEGER,
  status TEXT NOT NULL,
  calculated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS salary_results_user_applied_idx
  ON salary_results (user_id, applied_from);
