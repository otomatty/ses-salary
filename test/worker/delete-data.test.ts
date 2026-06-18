import { describe, it, expect, beforeEach } from "vitest";
import { request, postJson, login, createUserSession } from "./helpers";

describe("DELETE /api/user/data", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("ログイン中ユーザーの全データを削除し 200 を返す", async () => {
    // 単価3ヶ月分とランクを投入（スナップショットも生成される）
    await postJson("/api/prices", { yearMonth: "2025-10", unitPrice: 700000 }, cookie);
    await postJson("/api/prices", { yearMonth: "2025-11", unitPrice: 720000 }, cookie);
    await postJson("/api/prices", { yearMonth: "2025-12", unitPrice: 710000 }, cookie);
    await postJson("/api/rank", { rank: 2, effectiveFrom: "2025-10" }, cookie);
    // 残業・手当・設定も投入
    await postJson(
      "/api/allowances",
      { name: "役職手当", effectiveFrom: "2025-10", amount: 30000, includeInOvertimeBase: false },
      cookie,
    );
    await postJson(
      "/api/overtime",
      { yearMonth: "2025-12", normalHours: 25, nightHours: 0, holidayHours: 0 },
      cookie,
    );
    await postJson(
      "/api/settings",
      { employmentType: "contract_academia", monthlyStandardHours: 150, deemedOvertimeHours: null },
      cookie,
    );

    // 削除前はデータがある
    const before = await request("/api/dashboard", {}, cookie);
    const beforeBody = (await before.json()) as {
      prices: unknown[];
      rankHistory: unknown[];
      savedResults: unknown[];
      allowances: unknown[];
      overtime: unknown[];
      settings: { employmentType: string };
    };
    expect(beforeBody.prices.length).toBeGreaterThan(0);
    expect(beforeBody.rankHistory.length).toBeGreaterThan(0);
    expect(beforeBody.allowances.length).toBeGreaterThan(0);
    expect(beforeBody.overtime.length).toBeGreaterThan(0);
    expect(beforeBody.settings.employmentType).toBe("contract_academia");

    const res = await request("/api/user/data", { method: "DELETE" }, cookie);
    expect(res.status).toBe(200);
    expect((await res.json()) as { ok: boolean }).toEqual({ ok: true });

    // 削除後はすべて空（設定は既定値に戻る）
    const after = await request("/api/dashboard", {}, cookie);
    const afterBody = (await after.json()) as {
      prices: unknown[];
      rankHistory: unknown[];
      savedResults: unknown[];
      allowances: unknown[];
      overtime: unknown[];
      settings: { employmentType: string };
    };
    expect(afterBody.prices).toEqual([]);
    expect(afterBody.rankHistory).toEqual([]);
    expect(afterBody.savedResults).toEqual([]);
    expect(afterBody.allowances).toEqual([]);
    expect(afterBody.overtime).toEqual([]);
    expect(afterBody.settings.employmentType).toBe("fulltime_engineer");
  });

  it("削除後もアカウント（セッション）は維持される", async () => {
    await request("/api/user/data", { method: "DELETE" }, cookie);
    const me = await request("/api/me", {}, cookie);
    const body = (await me.json()) as { user: { id: string } | null };
    expect(body.user).not.toBeNull();
  });

  it("未ログインは 401", async () => {
    const res = await request("/api/user/data", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("他ユーザーのデータは削除されない（テナント分離）", async () => {
    const otherCookie = await createUserSession(
      "other-user-id",
      "other@example.com",
    );
    await postJson("/api/prices", { yearMonth: "2025-10", unitPrice: 800000 }, otherCookie);

    // 自分のデータを投入してから自分だけ削除
    await postJson("/api/prices", { yearMonth: "2025-10", unitPrice: 700000 }, cookie);
    await request("/api/user/data", { method: "DELETE" }, cookie);

    const other = await request("/api/dashboard", {}, otherCookie);
    const otherBody = (await other.json()) as { prices: unknown[] };
    expect(otherBody.prices.length).toBe(1);
  });
});
