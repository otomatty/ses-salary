import { describe, it, expect } from "vitest";
import { calcSalary, type PricePoint } from "../src/shared/calc";
import {
  buildSimulation,
  diffSimulation,
  latestTwoMonths,
} from "../src/shared/simulate";

function pp(yearMonth: string, unitPrice: number): PricePoint {
  return { yearMonth, unitPrice };
}

describe("latestTwoMonths", () => {
  it("最新の2ヶ月を古い順で返す", () => {
    const prices = [
      pp("2026-01", 100),
      pp("2026-03", 300),
      pp("2026-02", 200),
    ];
    expect(latestTwoMonths(prices)).toEqual([pp("2026-02", 200), pp("2026-03", 300)]);
  });

  it("2件未満ならある分だけ返す", () => {
    expect(latestTwoMonths([pp("2026-01", 100)])).toEqual([pp("2026-01", 100)]);
    expect(latestTwoMonths([])).toEqual([]);
  });
});

describe("buildSimulation", () => {
  it("最新月の翌月を適用月にして calcSalary と同じ給与を返す", () => {
    const months = [
      pp("2026-01", 1_000_000),
      pp("2026-02", 1_000_000),
      pp("2026-03", 1_000_000),
    ];
    const sim = buildSimulation(months, 2);
    expect(sim.appliedFrom).toBe("2026-04");
    expect(sim.periodLabel).toBe("2026-04 〜 2026-06");
    expect(sim.breakdown.salary).toBe(calcSalary(months, 2).salary);
    expect(sim.breakdown.salary).toBe(558_900);
  });

  it("入力順に依存せず適用月を決める", () => {
    const sim = buildSimulation(
      [pp("2026-03", 500_000), pp("2026-01", 500_000), pp("2026-02", 500_000)],
      1,
    );
    expect(sim.appliedFrom).toBe("2026-04");
  });
});

describe("diffSimulation", () => {
  const sim = calcSalary(
    [
      pp("2026-01", 1_000_000),
      pp("2026-02", 1_000_000),
      pp("2026-03", 1_000_000),
    ],
    2,
  ); // I帯, 558,900

  it("baseline が無ければ差分なし", () => {
    const d = diffSimulation(null, sim);
    expect(d.baseline).toBeNull();
    expect(d.salaryDelta).toBeNull();
    expect(d.bandChanged).toBe(false);
    expect(d.rankChanged).toBe(false);
  });

  it("給与差額・帯・ランクの変化を検出する", () => {
    const baseline = calcSalary(
      [
        pp("2025-10", 900_000),
        pp("2025-11", 900_000),
        pp("2025-12", 900_000),
      ],
      3,
    ); // H帯, ランク3
    const d = diffSimulation(baseline, sim);
    expect(d.salaryDelta).toBe((sim.salary ?? 0) - (baseline.salary ?? 0));
    expect(d.bandChanged).toBe(true); // H → I
    expect(d.rankChanged).toBe(true); // 3 → 2
  });

  it("要相談を含む場合は差額を計算しない", () => {
    const consult = calcSalary(
      [
        pp("2026-01", 1_400_000),
        pp("2026-02", 1_400_000),
        pp("2026-03", 1_400_000),
      ],
      2,
    );
    expect(diffSimulation(consult, sim).salaryDelta).toBeNull();
    expect(diffSimulation(sim, consult).salaryDelta).toBeNull();
  });

  it("同一条件なら変化なし", () => {
    const d = diffSimulation(sim, sim);
    expect(d.salaryDelta).toBe(0);
    expect(d.bandChanged).toBe(false);
    expect(d.rankChanged).toBe(false);
  });
});
