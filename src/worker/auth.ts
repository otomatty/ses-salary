/**
 * 認証（Google SSO）。
 *
 * - 本番: Google OAuth 2.0 認可コードフロー。会社ドメインに限定可能。
 * - 開発: DEV_AUTH=true のとき簡易ログイン（/auth/dev-login）を有効化。
 *
 * セッションは署名付き Cookie（lib/session.ts）で保持する。
 */

import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import type { Env } from "./env";
import { getDb, schema } from "./db";
import { newId } from "./lib/id";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
} from "./lib/session";

type AppEnv = { Bindings: Env; Variables: { userId: string } };

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const STATE_COOKIE = "ses_oauth_state";

const DEV_SECRET_FALLBACK = "dev-only-insecure-secret-change-me";

function isDevAuth(env: Env): boolean {
  return env.DEV_AUTH === "true";
}

/** セッション署名鍵。未設定でも開発時は固定値にフォールバック */
export function sessionSecret(env: Env): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (isDevAuth(env)) return DEV_SECRET_FALLBACK;
  throw new Error("SESSION_SECRET is not configured");
}

function redirectUri(env: Env): string {
  return `${env.APP_URL.replace(/\/$/, "")}/auth/callback`;
}

function secureCookie(env: Env): boolean {
  return env.APP_URL.startsWith("https://");
}

/** メールアドレスが許可ドメインに属するか */
function isAllowedEmail(env: Env, email: string): boolean {
  const domain = env.ALLOWED_EMAIL_DOMAIN?.trim();
  if (!domain) return true; // 未設定なら制限しない
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

/** ユーザーを email で取得、なければ作成して返す */
async function upsertUser(env: Env, email: string, name: string) {
  const db = getDb(env.DB);
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  if (existing) {
    // 名前が変わっていれば更新
    if (name && name !== existing.name) {
      await db
        .update(schema.users)
        .set({ name })
        .where(eq(schema.users.id, existing.id))
        .run();
    }
    return existing;
  }
  const user = {
    id: newId(),
    name: name || email.split("@")[0],
    email,
    createdAt: Date.now(),
  };
  await db.insert(schema.users).values(user).run();
  return user;
}

async function startSession(c: any, env: Env, userId: string) {
  const token = await createSessionToken(userId, sessionSecret(env));
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookie(env),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export const authApp = new Hono<AppEnv>();

/** ログイン開始: Google へリダイレクト */
authApp.get("/auth/login", async (c) => {
  const env = c.env;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return c.text(
      "Google OAuth が未設定です。GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を設定してください。",
      500,
    );
  }
  const state = newId();
  setCookie(c, STATE_COOKIE, state, {
    httpOnly: true,
    secure: secureCookie(env),
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(env),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  const domain = env.ALLOWED_EMAIL_DOMAIN?.trim();
  if (domain) params.set("hd", domain);

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

/** コールバック: コードをトークンに交換しセッションを作る */
authApp.get("/auth/callback", async (c) => {
  const env = c.env;
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });

  if (!code || !state || !savedState || state !== savedState) {
    return c.text("認証に失敗しました（state 不一致）。", 400);
  }
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return c.text("Google OAuth が未設定です。", 500);
  }

  // トークン交換
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(env),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return c.text("トークン取得に失敗しました。", 502);
  }
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    return c.text("アクセストークンが取得できませんでした。", 502);
  }

  // ユーザー情報取得
  const infoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) {
    return c.text("ユーザー情報の取得に失敗しました。", 502);
  }
  const info = (await infoRes.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  if (!info.email || info.email_verified === false) {
    return c.text("メールアドレスが確認できませんでした。", 403);
  }
  if (!isAllowedEmail(env, info.email)) {
    return c.text(
      "このアカウントではログインできません（許可されていないドメインです）。",
      403,
    );
  }

  const user = await upsertUser(env, info.email, info.name ?? "");
  await startSession(c, env, user.id);
  return c.redirect("/");
});

/** ログアウト */
authApp.post("/auth/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

/** 開発用の簡易ログイン（DEV_AUTH=true のときのみ） */
authApp.post("/auth/dev-login", async (c) => {
  const env = c.env;
  if (!isDevAuth(env)) return c.text("Not Found", 404);
  const user = await upsertUser(env, "dev@example.com", "開発ユーザー");
  await startSession(c, env, user.id);
  return c.json({ ok: true });
});

authApp.get("/auth/dev-login", async (c) => {
  const env = c.env;
  if (!isDevAuth(env)) return c.text("Not Found", 404);
  const user = await upsertUser(env, "dev@example.com", "開発ユーザー");
  await startSession(c, env, user.id);
  return c.redirect("/");
});

/** リクエストからログイン中のユーザーIDを取得（未ログインは null） */
export async function getUserIdFromRequest(
  c: any,
  env: Env,
): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    return await verifySessionToken(token, sessionSecret(env));
  } catch {
    return null;
  }
}
