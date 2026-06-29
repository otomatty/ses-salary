import { describe, it, expect } from "vitest";
import { calcSalary, type PricePoint } from "../src/shared/calc";
import { diffSimulation } from "../src/shared/simulate";

function pp(yearMonth: string, unitPrice: number): PricePoint {
  return { yearMonth, unitPrice };
}

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
