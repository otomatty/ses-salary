import { env } from "cloudflare:test";
import app from "../../src/worker/index";
import { createSessionToken, SESSION_COOKIE } from "../../src/worker/lib/session";

/**
 * Hono アプリへリクエストを投げる薄いラッパ。
 * cloudflare:test の env（D1 等のバインディング）をそのまま渡す。
 */
export async function request(
  path: string,
  init?: RequestInit,
  cookie?: string,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (cookie) headers.set("Cookie", cookie);
  return app.request(path, { ...init, headers }, env);
}

/** JSON ボディ付き POST。 */
export function postJson(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
  return request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    cookie,
  );
}

/**
 * 開発用ログイン（/auth/dev-login, DEV_AUTH=true）を実行し、
 * 後続リクエストに使えるセッション Cookie 文字列（`name=value`）を返す。
 * 常に同一ユーザー（dev@example.com）としてログインする。
 */
export async function login(): Promise<string> {
  const res = await request("/auth/dev-login", { method: "POST" });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("ログイン時にセッション Cookie が発行されませんでした");
  // "ses_session=...; Path=/; HttpOnly; ..." の先頭 `name=value` だけを取り出す。
  return setCookie.split(";")[0];
}

/**
 * 任意のユーザーを直接 D1 に作成し、そのユーザーとしてのセッション Cookie を返す。
 * テナント分離（他人のデータが見えない）を検証するため、複数ユーザーを用意したいときに使う。
 */
export async function createUserSession(
  id: string,
  email: string,
  name = "テストユーザー",
): Promise<string> {
  await env.DB.prepare(
    "INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, name, email, Date.now())
    .run();
  const token = await createSessionToken(id, env.SESSION_SECRET!);
  return `${SESSION_COOKIE}=${token}`;
}
