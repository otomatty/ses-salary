import { describe, it, expect, beforeEach } from "vitest";
import { request, postJson, login } from "./helpers";

describe("/api/prices", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("POST で新規作成し 201 を返す", async () => {
    const res = await postJson(
      "/api/prices",
      { yearMonth: "2026-01", unitPrice: 1_000_000 },
      cookie,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { price: { yearMonth: string; unitPrice: number } };
    expect(body.price.yearMonth).toBe("2026-01");
    expect(body.price.unitPrice).toBe(1_000_000);
  });

  it("同じ年月への POST は upsert（200・同一行を更新）", async () => {
    const first = await postJson(
      "/api/prices",
      { yearMonth: "2026-01", unitPrice: 1_000_000 },
      cookie,
    );
    const firstId = ((await first.json()) as { price: { id: string } }).price.id;

    const second = await postJson(
      "/api/prices",
      { yearMonth: "2026-01", unitPrice: 1_200_000 },
      cookie,
    );
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { price: { id: string; unitPrice: number } };
    expect(secondBody.price.id).toBe(firstId); // 同一行
    expect(secondBody.price.unitPrice).toBe(1_200_000);

    // 一覧でも1件のまま、値が更新されている
    const list = await request("/api/prices", {}, cookie);
    const prices = ((await list.json()) as { prices: { unitPrice: number }[] }).prices;
    expect(prices).toHaveLength(1);
    expect(prices[0].unitPrice).toBe(1_200_000);
  });

  it("GET は年月の昇順で返す", async () => {
    await postJson("/api/prices", { yearMonth: "2026-03", unitPrice: 3 }, cookie);
    await postJson("/api/prices", { yearMonth: "2026-01", unitPrice: 1 }, cookie);
    await postJson("/api/prices", { yearMonth: "2026-02", unitPrice: 2 }, cookie);
    const list = await request("/api/prices", {}, cookie);
    const prices = ((await list.json()) as { prices: { yearMonth: string }[] }).prices;
    expect(prices.map((p) => p.yearMonth)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("小数の単価は四捨五入して保存する", async () => {
    const res = await postJson(
      "/api/prices",
      { yearMonth: "2026-01", unitPrice: 1_000_000.6 },
      cookie,
    );
    const body = (await res.json()) as { price: { unitPrice: number } };
    expect(body.price.unitPrice).toBe(1_000_001);
  });

  it("DELETE で削除できる", async () => {
    const created = await postJson(
      "/api/prices",
      { yearMonth: "2026-01", unitPrice: 1 },
      cookie,
    );
    const id = ((await created.json()) as { price: { id: string } }).price.id;

    const del = await request(`/api/prices/${id}`, { method: "DELETE" }, cookie);
    expect(del.status).toBe(200);

    const list = await request("/api/prices", {}, cookie);
    expect((await list.json()) as { prices: unknown[] }).toEqual({ prices: [] });
  });

  describe("POST /api/prices/bulk（一括入力）", () => {
    it("連続月をまとめて作成し 201 を返す", async () => {
      const res = await postJson(
        "/api/prices/bulk",
        {
          items: [
            { yearMonth: "2026-04", unitPrice: 800_000 },
            { yearMonth: "2026-05", unitPrice: 800_000 },
            { yearMonth: "2026-06", unitPrice: 800_000 },
          ],
        },
        cookie,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { prices: { yearMonth: string }[] };
      expect(body.prices.map((p) => p.yearMonth)).toEqual([
        "2026-04",
        "2026-05",
        "2026-06",
      ]);

      const list = await request("/api/prices", {}, cookie);
      const prices = ((await list.json()) as { prices: unknown[] }).prices;
      expect(prices).toHaveLength(3);
    });

    it("既存月は上書き、新規月は作成する（混在 upsert）", async () => {
      await postJson(
        "/api/prices",
        { yearMonth: "2026-04", unitPrice: 700_000 },
        cookie,
      );
      const res = await postJson(
        "/api/prices/bulk",
        {
          items: [
            { yearMonth: "2026-04", unitPrice: 800_000 }, // 上書き
            { yearMonth: "2026-05", unitPrice: 800_000 }, // 新規
          ],
        },
        cookie,
      );
      expect(res.status).toBe(201);
      const list = await request("/api/prices", {}, cookie);
      const prices = (
        (await list.json()) as { prices: { yearMonth: string; unitPrice: number }[] }
      ).prices;
      expect(prices).toHaveLength(2);
      expect(prices.find((p) => p.yearMonth === "2026-04")?.unitPrice).toBe(
        800_000,
      );
    });

    it("空配列は 400", async () => {
      const res = await postJson("/api/prices/bulk", { items: [] }, cookie);
      expect(res.status).toBe(400);
    });

    it("1件でも不正なら全体を保存しない（400・原子性）", async () => {
      const res = await postJson(
        "/api/prices/bulk",
        {
          items: [
            { yearMonth: "2026-04", unitPrice: 800_000 },
            { yearMonth: "2026-13", unitPrice: 800_000 }, // 不正
          ],
        },
        cookie,
      );
      expect(res.status).toBe(400);
      const list = await request("/api/prices", {}, cookie);
      expect((await list.json()) as { prices: unknown[] }).toEqual({ prices: [] });
    });

    it("年月の重複は 400", async () => {
      const res = await postJson(
        "/api/prices/bulk",
        {
          items: [
            { yearMonth: "2026-04", unitPrice: 800_000 },
            { yearMonth: "2026-04", unitPrice: 900_000 },
          ],
        },
        cookie,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("バリデーション（400）", () => {
    it("年月の形式が不正", async () => {
      for (const yearMonth of ["2026-13", "2026/01", "26-01", "2026-1", "abc"]) {
        const res = await postJson("/api/prices", { yearMonth, unitPrice: 1 }, cookie);
        expect(res.status, yearMonth).toBe(400);
      }
    });

    it("単価が不正（負数・非数・上限超過）", async () => {
      for (const unitPrice of [-1, Number.NaN, "100", 100_000_001]) {
        const res = await postJson(
          "/api/prices",
          { yearMonth: "2026-01", unitPrice },
          cookie,
        );
        expect(res.status, String(unitPrice)).toBe(400);
      }
    });

    it("境界値: 単価 0 と上限ちょうど(1億)は許可", async () => {
      const zero = await postJson("/api/prices", { yearMonth: "2026-01", unitPrice: 0 }, cookie);
      expect(zero.status).toBe(201);
      const max = await postJson(
        "/api/prices",
        { yearMonth: "2026-02", unitPrice: 100_000_000 },
        cookie,
      );
      expect(max.status).toBe(201);
    });
  });
});
