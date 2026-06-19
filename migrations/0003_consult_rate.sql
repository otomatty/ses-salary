-- M帯(要相談 / 140万円以上)向けの手動還元率(%)。
-- 設定すると要相談ではなく「率 × 平均単価」で給与を自動計算する。
-- null（既定）は従来どおり要相談（自動計算の対象外）。
ALTER TABLE user_settings ADD COLUMN consult_rate REAL;
