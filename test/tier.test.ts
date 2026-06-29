import { describe, it, expect } from "vitest";
import {
  findTier,
  tierForBand,
  latestUnitPrice,
  unitPriceForMonth,
  RATE_BANDS,
  TIER_GOLD_MIN,
  TIER_SILVER_MIN,
} from "../src/shared/rateTable";

describe("ティア判定（findTier）", () => {
  it("Gold は 90万円以上", () => {
    expect(findTier(TIER_GOLD_MIN)).toBe("gold");
    expect(findTier(900_001)).toBe("gold");
    expect(findTier(1_400_000)).toBe("gold");
    expect(findTier(9_999_999)).toBe("gold");
  });

  it("Silver は 60万〜89万9999円", () => {
    expect(findTier(TIER_SILVER_MIN)).toBe("silver");
    expect(findTier(899_999)).toBe("silver");
    expect(findTier(750_000)).toBe("silver");
  });

  it("Bronze は 60万円未満", () => {
    expect(findTier(599_999)).toBe("bronze");
    expect(findTier(400_000)).toBe("bronze");
    expect(findTier(0)).toBe("bronze");
    expect(findTier(-1)).toBe("bronze");
  });

  it("境界ちょうどで切り替わる（Silver→Gold / Bronze→Silver）", () => {
    expect(findTier(TIER_GOLD_MIN - 1)).toBe("silver");
    expect(findTier(TIER_GOLD_MIN)).toBe("gold");
    expect(findTier(TIER_SILVER_MIN - 1)).toBe("bronze");
    expect(findTier(TIER_SILVER_MIN)).toBe("silver");
  });
});

describe("帯ごとのティア（tierForBand）", () => {
  it("還元率テーブルの帯境界とティア境界が一致する", () => {
    const byCode = Object.fromEntries(
      RATE_BANDS.map((b) => [b.code, tierForBand(b)]),
    );
    // Gold: H 以上
    expect(byCode.M).toBe("gold");
    expect(byCode.H).toBe("gold");
    // Silver: D〜G
    expect(byCode.G).toBe("silver");
    expect(byCode.D).toBe("silver");
    // Bronze: C 以下
    expect(byCode.C).toBe("bronze");
    expect(byCode["A-0"]).toBe("bronze");
    expect(byCode.FIXED).toBe("bronze");
  });
});

describe("最新月の単価（latestUnitPrice）", () => {
  it("年月の降順で最新の単価を返す", () => {
    expect(
      latestUnitPrice([
        { yearMonth: "2026-01", unitPrice: 500_000 },
        { yearMonth: "2026-03", unitPrice: 950_000 },
        { yearMonth: "2026-02", unitPrice: 700_000 },
      ]),
    ).toBe(950_000);
  });

  it("年跨ぎでも辞書順=時系列順で判定する", () => {
    expect(
      latestUnitPrice([
        { yearMonth: "2025-12", unitPrice: 800_000 },
        { yearMonth: "2026-01", unitPrice: 620_000 },
      ]),
    ).toBe(620_000);
  });

  it("空配列は null", () => {
    expect(latestUnitPrice([])).toBeNull();
  });
});

describe("今月の単価（unitPriceForMonth）", () => {
  const prices = [
    { yearMonth: "2026-01", unitPrice: 500_000 },
    { yearMonth: "2026-03", unitPrice: 950_000 },
    { yearMonth: "2026-06", unitPrice: 700_000 },
  ];

  it("指定月の単価を返す", () => {
    expect(unitPriceForMonth(prices, "2026-06")).toBe(700_000);
    expect(unitPriceForMonth(prices, "2026-01")).toBe(500_000);
  });

  it("最新月ではなく指定月で判定する（直近月と異なる月でも一致する）", () => {
    expect(unitPriceForMonth(prices, "2026-03")).toBe(950_000);
  });

  it("指定月の単価が未登録なら null", () => {
    expect(unitPriceForMonth(prices, "2026-05")).toBeNull();
    expect(unitPriceForMonth([], "2026-06")).toBeNull();
  });
});
