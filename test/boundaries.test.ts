import { describe, it, expect } from "vitest";
import { findBand, RATE_BANDS } from "../src/shared/rateTable";
import {
  averageUnitPrice,
  calcSalary,
  type PricePoint,
} from "../src/shared/calc";
import {
  computeSalaryForAppliedMonth,
  buildSalaryHistory,
  rankAt,
  type RankHistoryEntry,
} from "../src/shared/periods";

function months(...prices: number[]): PricePoint[] {
  return prices.map((p, i) => ({
    yearMonth: `2026-${String(i + 1).padStart(2, "0")}`,
    unitPrice: p,
  }));
}

describe("帯境界（findBand）", () => {
  // 各帯について「下限ちょうど」「上限ちょうど」がその帯に入り、
  // 「下限 - 1」が一つ下の帯へ落ちることを総当たりで確認する。
  for (const band of RATE_BANDS) {
    it(`${band.code}: min(${band.min})${band.max !== null ? ` / max(${band.max})` : ""} が帯内`, () => {
      expect(findBand(band.min).code).toBe(band.code);
      if (band.max !== null) {
        expect(findBand(band.max).code).toBe(band.code);
      }
    });

    if (band.min > 0) {
      it(`${band.code}: min - 1(${band.min - 1}) は一つ下の帯`, () => {
        // RATE_BANDS は高い順。min-1 は必ず下位帯に属する。
        const below = findBand(band.min - 1);
        expect(below.code).not.toBe(band.code);
        expect(below.max).toBe(band.min - 1);
      });
    }
  }

  it("負値・極端な高値も取りこぼさない", () => {
    expect(findBand(-1).code).toBe("FIXED");
    expect(findBand(0).code).toBe("FIXED");
    expect(findBand(999_999_999).code).toBe("M");
  });

  it("帯は隙間なく連続している（ある帯の max+1 = 次の帯の min）", () => {
    // 高い順に並ぶので、隣り合う帯で lower.max + 1 === upper.min を満たす。
    for (let i = 0; i < RATE_BANDS.length - 1; i++) {
      const upper = RATE_BANDS[i];
      const lower = RATE_BANDS[i + 1];
      expect(lower.max).not.toBeNull();
      expect((lower.max as number) + 1).toBe(upper.min);
    }
  });
});

describe("平均単価の端数（四捨五入）", () => {
  it(".5 は切り上げ", () => {
    expect(averageUnitPrice([100, 101])).toBe(101); // 100.5 → 101
    expect(averageUnitPrice([1_000_000, 1_000_001, 1_000_001])).toBe(1_000_001); // 1,000,000.67
  });

  it(".5 未満は切り捨て", () => {
    expect(averageUnitPrice([100, 100, 101])).toBe(100); // 100.33 → 100
  });

  it("空配列は 0", () => {
    expect(averageUnitPrice([])).toBe(0);
  });

  it("平均の端数で帯がまたぐ境界を踏む", () => {
    // 平均が 399,999.67 → 四捨五入で 400,000 となり FIXED ではなく A-0 になる。
    const r = calcSalary(months(399_999, 400_000, 400_000), 2);
    expect(r.avgUnitPrice).toBe(400_000);
    expect(r.band.code).toBe("A-0");
  });
});

describe("給与額の端数（四捨五入）", () => {
  it("率計算の .5 は切り上げ", () => {
    // I帯ランク2(55.89%) で平均 1,000,001 → 558,900.5589 → 558,901
    const r = calcSalary(months(1_000_001, 1_000_001, 1_000_001), 2);
    expect(r.salary).toBe(558_901);
  });

  it("単一レート帯(A-0=55%)も四捨五入する", () => {
    // 401,001 × 55% = 220,550.55 → 220,551
    const r = calcSalary(months(401_001, 401_001, 401_001), 1);
    expect(r.band.code).toBe("A-0");
    expect(r.salary).toBe(Math.round(401_001 * 0.55));
  });
});

describe("ランク履歴の切替（境界月）", () => {
  const history: RankHistoryEntry[] = [
    { effectiveFrom: "2026-01", rank: 1 },
    { effectiveFrom: "2026-04", rank: 3 },
  ];

  it("rankAt は effectiveFrom ちょうどで新ランクへ切り替わる", () => {
    expect(rankAt(history, "2026-03")).toBe(1); // 切替前
    expect(rankAt(history, "2026-04")).toBe(3); // 切替月ちょうど
    expect(rankAt(history, "2026-05")).toBe(3); // 切替後
  });

  it("computeSalaryForAppliedMonth は適用月のランクで率が変わる", () => {
    const priceMap = new Map([
      ["2025-12", 1_000_000],
      ["2026-01", 1_000_000],
      ["2026-02", 1_000_000],
      ["2026-03", 1_000_000],
      ["2026-04", 1_000_000],
    ]);
    // 適用月 2026-03（直前3ヶ月 2025-12..2026-02）→ ランク1（54.52%）
    const before = computeSalaryForAppliedMonth("2026-03", priceMap, history);
    expect(before?.breakdown.rank).toBe(1);
    expect(before?.breakdown.rate).toBe(54.52);
    // 適用月 2026-04 → 切替後ランク3（57.26%）
    const after = computeSalaryForAppliedMonth("2026-04", priceMap, history);
    expect(after?.breakdown.rank).toBe(3);
    expect(after?.breakdown.rate).toBe(57.26);
    expect(after!.breakdown.salary!).toBeGreaterThan(before!.breakdown.salary!);
  });

  it("buildSalaryHistory は各適用月で切替後のランクを反映する", () => {
    const prices = months(
      1_000_000, // 2026-01
      1_000_000, // 2026-02
      1_000_000, // 2026-03
      1_000_000, // 2026-04
      1_000_000, // 2026-05
    );
    // buildSalaryHistory の最初の適用月は first + 3ヶ月 = 2026-04。
    // 境界を履歴内で跨がせるため、切替を 2026-05 に置く。
    const switchAt05: RankHistoryEntry[] = [
      { effectiveFrom: "2026-01", rank: 1 },
      { effectiveFrom: "2026-05", rank: 3 },
    ];
    const results = buildSalaryHistory(prices, switchAt05);
    const byMonth = new Map(results.map((r) => [r.appliedFrom, r]));
    // 適用 2026-04 は切替前のランク1
    expect(byMonth.get("2026-04")?.breakdown.rank).toBe(1);
    // 適用 2026-05 は切替月ちょうどでランク3
    expect(byMonth.get("2026-05")?.breakdown.rank).toBe(3);
  });
});
