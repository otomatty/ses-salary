import { describe, it, expect } from "vitest";
import { request, postJson, login, createUserSession } from "./helpers";

describe("認可（未ログイン）", () => {
  it("GET /api/me は未ログインでも 200 で user:null を返す", async () => {
    const res = await request("/api/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it("保護された API は Cookie 無しなら 401", async () => {
    for (const path of ["/api/dashboard", "/api/prices", "/api/salary-results"]) {
      const res = await request(path);
      expect(res.status, path).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("POST/DELETE も Cookie 無しなら 401", async () => {
    const post = await postJson("/api/prices", { yearMonth: "2026-01", unitPrice: 1 });
    expect(post.status).toBe(401);
    const del = await request("/api/prices/whatever", { method: "DELETE" });
    expect(del.status).toBe(401);
  });

  it("壊れたセッション Cookie は未ログイン扱い", async () => {
    const res = await request("/api/dashboard", {}, "ses_session=not-a-valid-token");
    expect(res.status).toBe(401);
  });
});

describe("認可（ログイン）", () => {
  it("dev-login 後は /api/me が本人を返す", async () => {
    const cookie = await login();
    const res = await request("/api/me", {}, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } | null };
    expect(body.user?.email).toBe("dev@example.com");
  });

  it("ログイン後は保護 API にアクセスできる", async () => {
    const cookie = await login();
    const res = await request("/api/dashboard", {}, cookie);
    expect(res.status).toBe(200);
  });
});

describe("テナント分離（他人のデータは見えない・消せない）", () => {
  it("ユーザーAの単価はユーザーBから見えず、Bは削除もできない", async () => {
    const aCookie = await createUserSession("user-a", "a@example.com");
    const bCookie = await createUserSession("user-b", "b@example.com");

    // A が単価を登録
    const created = await postJson(
      "/api/prices",
      { yearMonth: "2026-01", unitPrice: 1_000_000 },
      aCookie,
    );
    expect(created.status).toBe(201);
    const { price } = (await created.json()) as { price: { id: string } };

    // B からは A の単価が見えない
    const bList = await request("/api/prices", {}, bCookie);
    expect((await bList.json()) as { prices: unknown[] }).toEqual({ prices: [] });

    // B が A の月を削除しようとしても、A 側には残る（user_id 条件で守られている）
    void price;
    const bDelete = await request(`/api/months/2026-01`, { method: "DELETE" }, bCookie);
    expect(bDelete.status).toBe(200); // 冪等。実際には何も消えない

    const aList = await request("/api/prices", {}, aCookie);
    const aBody = (await aList.json()) as { prices: { id: string }[] };
    expect(aBody.prices).toHaveLength(1);
    expect(aBody.prices[0].id).toBe(price.id);
  });
});
