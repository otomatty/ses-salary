/**
 * Worker のエントリポイント。
 *
 * - /auth/*  認証（Google SSO / 開発用ログイン）
 * - /api/*   認証済み API
 * - それ以外 静的アセット（React SPA）。wrangler.jsonc の
 *   not_found_handling: single-page-application により index.html を返す。
 */

import { Hono } from "hono";
import type { Env } from "./env";
import { authApp } from "./auth";
import { apiApp } from "./routes/api";

const app = new Hono<{ Bindings: Env }>();

app.route("/", authApp);
app.route("/", apiApp);

// 上記にマッチしないリクエストは静的アセット（SPA）へ委譲する。
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
