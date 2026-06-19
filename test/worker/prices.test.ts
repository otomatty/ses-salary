import { describe, it, expect, beforeEach } from "vitest";
import { request, postJson, login } from "./helpers";
import { BULK_MAX_MONTHS } from "@shared/periods";

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

  it("DELETE /api/months/:yearMonth で削除できる", async () => {
    await postJson("/api/prices", { yearMonth: "2026-01", unitPrice: 1 }, cookie);

    const del = await request("/api/months/2026-01", { method: "DELETE" }, cookie);
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

    it("複数四半期にまたがる一括保存は、完了した各四半期のスナップショットを保存する", async () => {
      // 2026-01〜06（Q1・Q2 の2四半期）を一括保存。個別入力した場合と同じく
      // Q1→2026-04、Q2→2026-07 の両方のスナップショットが永続化されるべき。
      const items = [
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
      ].map((ym) => ({ yearMonth: ym, unitPrice: 1_000_000 }));
      const res = await postJson("/api/prices/bulk", { items }, cookie);
      expect(res.status).toBe(201);

      const dash = await request("/api/dashboard", {}, cookie);
      const body = (await dash.json()) as {
        savedResults: {
          appliedFrom: string;
          salary: number | null;
          status: string;
        }[];
      };
      const applied = body.savedResults.map((r) => r.appliedFrom);
      expect(applied).toContain("2026-04"); // Q1(01-03) 由来
      expect(applied).toContain("2026-07"); // Q2(04-06) 由来
      const apr = body.savedResults.find((r) => r.appliedFrom === "2026-04");
      expect(apr?.salary).toBe(545_200); // 平均100万・暫定ランク1 → I帯 54.52%
      expect(apr?.status).toBe("ok");
    });

    it("空配列は 400", async () => {
      const res = await postJson("/api/prices/bulk", { items: [] }, cookie);
      expect(res.status).toBe(400);
    });

    it("上限ヶ月数を超える件数は 400（切り捨てず拒否）", async () => {
      // 2020-01 から上限 +1 ヶ月分（将来 BULK_MAX_MONTHS が変わっても追従）。
      const items = Array.from({ length: BULK_MAX_MONTHS + 1 }, (_, i) => {
        const total = 2020 * 12 + i;
        const y = Math.floor(total / 12);
        const m = (total % 12) + 1;
        return {
          yearMonth: `${y}-${String(m).padStart(2, "0")}`,
          unitPrice: 800_000,
        };
      });
      const res = await postJson("/api/prices/bulk", { items }, cookie);
      expect(res.status).toBe(400);
      // 1件も保存されていない（原子性）。
      const list = await request("/api/prices", {}, cookie);
      expect((await list.json()) as { prices: unknown[] }).toEqual({ prices: [] });
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
