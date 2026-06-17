/**
 * 軽量なステートレス・セッション。
 *
 * セッション情報（ユーザーID・有効期限）を JSON にし、HMAC-SHA256 で署名して
 * Cookie に格納する。DB にセッションテーブルを持たないため D1 への負荷が小さい。
 */

const encoder = new TextEncoder();

/** base64url エンコード（パディングなし） */
function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

interface SessionPayload {
  uid: string;
  /** 有効期限（unix ms） */
  exp: number;
}

export const SESSION_COOKIE = "ses_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30日

/** セッショントークンを生成する */
export async function createSessionToken(
  uid: string,
  secret: string,
  ttlMs: number = SESSION_TTL_MS,
): Promise<string> {
  const payload: SessionPayload = { uid, exp: Date.now() + ttlMs };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body) as BufferSource,
  );
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

/** セッショントークンを検証し、有効ならユーザーIDを返す */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(sig) as BufferSource,
    encoder.encode(body) as BufferSource,
  );
  if (!valid) return null;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.uid !== "string" || !payload.uid) return null;
    return payload.uid;
  } catch {
    return null;
  }
}
