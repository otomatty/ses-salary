-- Google ログイン時に取得するプロフィール画像URL。
-- null（既定）はアイコン未取得（イニシャル表示にフォールバック）。
ALTER TABLE users ADD COLUMN avatar_url TEXT;
