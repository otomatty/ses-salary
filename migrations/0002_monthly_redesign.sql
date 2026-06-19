-- 月別入力への再設計（月ごとに単価・残業・手当を1ヶ所で入力する）。
-- 既存の monthly_prices / monthly_overtime を「月ごとの入力」1表に統合し、
-- 手当は履歴方式（allowance_history）から月別方式（monthly_allowances）へ完全に置き換える。
-- データは作り直す前提のため、旧テーブルは破棄する。

DROP TABLE IF EXISTS allowance_history;
DROP TABLE IF EXISTS monthly_overtime;
DROP TABLE IF EXISTS monthly_prices;

-- 月ごとの入力（単価＋残業時間）。年月ごとに1件。
CREATE TABLE IF NOT EXISTS monthly_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  overtime_normal_hours REAL NOT NULL DEFAULT 0,
  overtime_night_hours REAL NOT NULL DEFAULT 0,
  overtime_holiday_hours REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_entries_user_month_unique
  ON monthly_entries (user_id, year_month);

-- 月ごとの手当（年月 × 手当名ごとに1件）。
CREATE TABLE IF NOT EXISTS monthly_allowances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  include_in_overtime_base INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_allowances_user_month_name_unique
  ON monthly_allowances (user_id, year_month, name);
