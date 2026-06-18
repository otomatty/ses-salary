-- 残業時間・特別手当の入力対応（月収のより正確な算出）
-- 月収 = 基本給（四半期給与） + 特別手当 + 残業代 を構成するためのテーブルを追加する。

-- 本人設定（雇用形態・月平均所定労働時間・みなし残業時間の上書き）
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employment_type TEXT NOT NULL,
  monthly_standard_hours REAL NOT NULL,
  deemed_overtime_hours REAL,
  updated_at INTEGER NOT NULL
);

-- 特別手当の履歴（手当名 × 適用開始年月ごと。amount 0 で廃止）
CREATE TABLE IF NOT EXISTS allowance_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  amount INTEGER NOT NULL,
  include_in_overtime_base INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS allowance_history_user_name_effective_unique
  ON allowance_history (user_id, name, effective_from);

-- 月次の残業時間（年月ごとに1件）
CREATE TABLE IF NOT EXISTS monthly_overtime (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  normal_hours REAL NOT NULL,
  night_hours REAL NOT NULL,
  holiday_hours REAL NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_overtime_user_month_unique
  ON monthly_overtime (user_id, year_month);
