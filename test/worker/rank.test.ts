import { describe, it, expect, beforeEach } from "vitest";
import { request, postJson, login } from "./helpers";
import { currentYearMonth } from "@shared/periods";

describe("/api/rank", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("POST で評価ランクを登録し 201 を返す", async () => {
    const res = await postJson(
      "/api/rank",
      { rank: 3, effectiveFrom: "2026-01" },
      cookie,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { rank: { effectiveFrom: string; rank: number } };
    expect(body.rank).toMatchObject({ effectiveFrom: "2026-01", rank: 3 });
  });

  it("effectiveFrom 省略時は当月から適用", async () => {
    const res = await postJson("/api/rank", { rank: 2 }, cookie);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { rank: { effectiveFrom: string } };
    expect(body.rank.effectiveFrom).toBe(currentYearMonth());
  });

  it("同じ effectiveFrom への POST は upsert（200・同一行）", async () => {
    const first = await postJson("/api/rank", { rank: 1, effectiveFrom: "2026-01" }, cookie);
    const firstId = ((await first.json()) as { rank: { id: string } }).rank.id;

    const second = await postJson("/api/rank", { rank: 3, effectiveFrom: "2026-01" }, cookie);
    expect(second.status).toBe(200);
    const body = (await second.json()) as { rank: { id: string; rank: number } };
    expect(body.rank.id).toBe(firstId);
    expect(body.rank.rank).toBe(3);
  });

  it("ダッシュボードへ反映され、暫定フラグが解除される", async () => {
    // ランク未設定なら暫定
    const before = await request("/api/dashboard", {}, cookie);
    expect(((await before.json()) as { rankProvisional: boolean }).rankProvisional).toBe(true);

    // 当月以前の effectiveFrom で設定すると確定になる
    await postJson("/api/rank", { rank: 3, effectiveFrom: "2020-01" }, cookie);
    const after = await request("/api/dashboard", {}, cookie);
    const body = (await after.json()) as { rankProvisional: boolean; currentRank: number };
    expect(body.rankProvisional).toBe(false);
    expect(body.currentRank).toBe(3);
  });

  describe("バリデーション（400）", () => {
    it("rank が 1/2/3 以外", async () => {
      for (const rank of [0, 4, "1", 2.5, null]) {
        const res = await postJson("/api/rank", { rank, effectiveFrom: "2026-01" }, cookie);
        expect(res.status, String(rank)).toBe(400);
      }
    });

    it("effectiveFrom の形式が不正", async () => {
      const res = await postJson("/api/rank", { rank: 1, effectiveFrom: "2026-13" }, cookie);
      expect(res.status).toBe(400);
    });
  });
});
