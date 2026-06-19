import { describe, it, expect } from "vitest";
import { calcSalary, averageUnitPrice, type PricePoint } from "../src/shared/calc";
import { findBand } from "../src/shared/rateTable";
import {
  addMonths,
  precedingMonths,
  quarterStartMonth,
  quarterMonths,
  prevQuarterStart,
  nextQuarterStart,
  rankAt,
  isRankProvisional,
  computeSalaryForQuarter,
  buildSalaryHistory,
} from "../src/shared/periods";

function months(...prices: number[]): PricePoint[] {
  return prices.map((p, i) => ({ yearMonth: `2026-0${i + 1}`, unitPrice: p }));
}

describe("averageUnitPrice", () => {
  it("単純平均を四捨五入する", () => {
    expect(averageUnitPrice([1_000_000, 1_000_000, 1_000_000])).toBe(1_000_000);
    expect(averageUnitPrice([1_000_000, 1_000_001, 1_000_001])).toBe(1_000_001);
  });
});

describe("findBand", () => {
  it("帯境界を正しく判定する", () => {
    expect(findBand(1_400_000).code).toBe("M");
    expect(findBand(1_399_999).code).toBe("L");
    expect(findBand(1_000_000).code).toBe("I");
    expect(findBand(1_099_999).code).toBe("I");
    expect(findBand(500_000).code).toBe("B");
    expect(findBand(499_999).code).toBe("A-1");
    expect(findBand(450_000).code).toBe("A-1");
    expect(findBand(449_999).code).toBe("A-0");
    expect(findBand(400_000).code).toBe("A-0");
    expect(findBand(399_999).code).toBe("FIXED");
    expect(findBand(0).code).toBe("FIXED");
  });
});

describe("calcSalary", () => {
  it("PRD例: 平均100万・ランク2 → I帯 55.89% = 558,900", () => {
    const r = calcSalary(months(1_000_000, 1_000_000, 1_000_000), 2);
    expect(r.status).toBe("ok");
    expect(r.band.code).toBe("I");
    expect(r.rate).toBe(55.89);
    expect(r.salary).toBe(558_900);
    expect(r.formula).toBe("1,000,000 × 55.89% = 558,900");
  });

  it("140万以上は要相談（自動計算対象外）", () => {
    const r = calcSalary(months(1_400_000, 1_400_000, 1_400_000), 1);
    expect(r.status).toBe("consult");
    expect(r.salary).toBeNull();
    expect(r.rate).toBeNull();
  });

  it("140万以上でも手動還元率を渡すと率×平均単価で計算する", () => {
    const r = calcSalary(months(1_400_000, 1_400_000, 1_400_000), 1, 56);
    expect(r.band.code).toBe("M");
    expect(r.status).toBe("ok");
    expect(r.rate).toBe(56);
    expect(r.salary).toBe(Math.round(1_400_000 * 0.56));
  });

  it("手動還元率が null/0 のときは従来どおり要相談", () => {
    const m = months(1_400_000, 1_400_000, 1_400_000);
    expect(calcSalary(m, 1, null).status).toBe("consult");
    expect(calcSalary(m, 1, 0).status).toBe("consult");
    expect(calcSalary(m, 1, null).salary).toBeNull();
  });

  it("40万未満は固定額235,000円", () => {
    const r = calcSalary(months(390_000, 390_000, 390_000), 3);
    expect(r.status).toBe("fixed");
    expect(r.salary).toBe(235_000);
  });

  it("A-0は単一レート55.00%（ランク不問）", () => {
    const r1 = calcSalary(months(420_000, 420_000, 420_000), 1);
    const r3 = calcSalary(months(420_000, 420_000, 420_000), 3);
    expect(r1.band.code).toBe("A-0");
    expect(r1.rate).toBe(55.0);
    expect(r1.salary).toBe(Math.round(420_000 * 0.55));
    expect(r3.salary).toBe(r1.salary); // ランクに依存しない
  });

  it("A-1は単一レート54.45%", () => {
    const r = calcSalary(months(480_000, 480_000, 480_000), 2);
    expect(r.band.code).toBe("A-1");
    expect(r.rate).toBe(54.45);
    expect(r.salary).toBe(Math.round(480_000 * 0.5445));
  });

  it("ランクごとに還元率が変わる（L帯）", () => {
    const base = months(1_300_000, 1_300_000, 1_300_000);
    expect(calcSalary(base, 1).rate).toBe(56.34);
    expect(calcSalary(base, 2).rate).toBe(57.71);
    expect(calcSalary(base, 3).rate).toBe(59.08);
  });

  it("給与は四捨五入される", () => {
    // 平均 1,000,001 × 55.89% = 558,900.5589 → 558,901
    const r = calcSalary(months(1_000_001, 1_000_001, 1_000_001), 2);
    expect(r.salary).toBe(Math.round(1_000_001 * 0.5589));
  });
});

describe("periods helpers", () => {
  it("addMonths は年跨ぎを処理する", () => {
    expect(addMonths("2026-01", 1)).toBe("2026-02");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-03", 2)).toBe("2026-05");
  });

  it("precedingMonths は直前N月を古い順で返す", () => {
    expect(precedingMonths("2026-04", 3)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("quarterStartMonth は四半期の開始月へ正規化する", () => {
    expect(quarterStartMonth("2026-01")).toBe("2026-01");
    expect(quarterStartMonth("2026-03")).toBe("2026-01");
    expect(quarterStartMonth("2026-04")).toBe("2026-04");
    expect(quarterStartMonth("2026-09")).toBe("2026-07");
    expect(quarterStartMonth("2026-12")).toBe("2026-10");
  });

  it("quarterMonths は四半期の3ヶ月を古い順で返す", () => {
    expect(quarterMonths("2026-07")).toEqual(["2026-07", "2026-08", "2026-09"]);
    // 開始月でなくても正規化される
    expect(quarterMonths("2026-05")).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("prev/nextQuarterStart は四半期を跨ぐ（年跨ぎ含む）", () => {
    expect(prevQuarterStart("2026-04")).toBe("2026-01");
    expect(prevQuarterStart("2026-01")).toBe("2025-10");
    expect(nextQuarterStart("2026-10")).toBe("2027-01");
    expect(nextQuarterStart("2026-04")).toBe("2026-07");
  });

  it("rankAt は適用開始月以前で最新のランクを返す", () => {
    const history = [
      { effectiveFrom: "2026-01", rank: 1 as const },
      { effectiveFrom: "2026-04", rank: 3 as const },
    ];
    expect(rankAt(history, "2026-03")).toBe(1);
    expect(rankAt(history, "2026-04")).toBe(3);
    expect(rankAt(history, "2025-12")).toBe(1); // fallback（デフォルトはランク1）
  });
});

describe("isRankProvisional", () => {
  it("履歴が空なら暫定", () => {
    expect(isRankProvisional([], "2026-06")).toBe(true);
  });

  it("対象月以前に履歴があれば確定", () => {
    const history = [{ effectiveFrom: "2026-01", rank: 3 as const }];
    expect(isRankProvisional(history, "2026-06")).toBe(false);
    expect(isRankProvisional(history, "2026-01")).toBe(false);
  });

  it("対象月より後の履歴しかなければ暫定", () => {
    const history = [{ effectiveFrom: "2026-07", rank: 3 as const }];
    expect(isRankProvisional(history, "2026-06")).toBe(true);
  });
});

describe("computeSalaryForQuarter", () => {
  it("直前四半期の3ヶ月が揃っていなければ null", () => {
    const priceMap = new Map([
      ["2026-01", 1_000_000],
      ["2026-02", 1_000_000],
    ]);
    // 適用四半期 Q2(2026-04) は直前四半期 Q1(2026-01..03) を必要とする
    expect(computeSalaryForQuarter("2026-04", priceMap, [])).toBeNull();
  });

  it("直前四半期の平均から次の四半期の給与を計算する", () => {
    const priceMap = new Map([
      ["2026-01", 1_000_000],
      ["2026-02", 1_000_000],
      ["2026-03", 1_000_000],
    ]);
    const r = computeSalaryForQuarter("2026-04", priceMap, []);
    // 暫定ランク1 → I帯 54.52% = 545,200
    expect(r?.breakdown.salary).toBe(545_200);
    expect(r?.appliedFrom).toBe("2026-04");
    expect(r?.periodLabel).toBe("2026-04 〜 2026-06");
  });

  it("四半期内の任意の月を渡しても開始月へ正規化する", () => {
    const priceMap = new Map([
      ["2026-01", 1_000_000],
      ["2026-02", 1_000_000],
      ["2026-03", 1_000_000],
    ]);
    // Q2 の中の 2026-05 を渡しても Q2(開始 2026-04) として計算する
    const r = computeSalaryForQuarter("2026-05", priceMap, []);
    expect(r?.appliedFrom).toBe("2026-04");
  });

  it("ランク履歴が空なら rankProvisional=true（暫定ランクで計算）", () => {
    const priceMap = new Map([
      ["2026-01", 1_000_000],
      ["2026-02", 1_000_000],
      ["2026-03", 1_000_000],
    ]);
    const r = computeSalaryForQuarter("2026-04", priceMap, []);
    expect(r?.rankProvisional).toBe(true);
    expect(r?.breakdown.rank).toBe(1); // fallback（デフォルトはランク1）
  });

  it("適用四半期以前にランク履歴があれば rankProvisional=false", () => {
    const priceMap = new Map([
      ["2026-01", 1_000_000],
      ["2026-02", 1_000_000],
      ["2026-03", 1_000_000],
    ]);
    const history = [{ effectiveFrom: "2026-01", rank: 3 as const }];
    const r = computeSalaryForQuarter("2026-04", priceMap, history);
    expect(r?.rankProvisional).toBe(false);
    expect(r?.breakdown.rank).toBe(3);
  });
});

describe("buildSalaryHistory", () => {
  it("3ヶ月未満なら空", () => {
    expect(buildSalaryHistory(months(1_000_000, 1_000_000), [])).toEqual([]);
  });

  it("最新データの四半期の次（来期）まで給与を出す", () => {
    const prices = months(1_000_000, 1_000_000, 1_000_000); // 2026-01..03 = Q1
    const history = buildSalaryHistory(prices, []);
    // 適用四半期は Q2(2026-04) のみ（Q1 の次）
    expect(history).toHaveLength(1);
    expect(history[0].appliedFrom).toBe("2026-04");
  });
});
