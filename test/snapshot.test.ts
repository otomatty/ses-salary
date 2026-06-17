import { describe, it, expect } from "vitest";
import { calcSalary, type PricePoint } from "../src/shared/calc";
import {
  buildNextPeriodSnapshot,
  toSnapshot,
  computeSalaryForQuarter,
  type RankHistoryEntry,
} from "../src/shared/periods";

function pp(yearMonth: string, unitPrice: number): PricePoint {
  return { yearMonth, unitPrice };
}

describe("toSnapshot", () => {
  it("通常計算の内訳を永続化フィールドへ写す", () => {
    const result = computeSalaryForQuarter(
      "2026-04",
      new Map([
        ["2026-01", 1_000_000],
        ["2026-02", 1_000_000],
        ["2026-03", 1_000_000],
      ]),
      [],
    )!;
    const snap = toSnapshot(result);
    expect(snap).toEqual({
      appliedFrom: "2026-04",
      avgUnitPrice: 1_000_000,
      appliedBand: "I",
      appliedRank: 1, // 履歴なし → fallback 1
      appliedRate: 54.52,
      salary: 545_200,
      status: "ok",
    });
  });

  it("要相談は率・給与を null、status を consult にする", () => {
    const snap = toSnapshot(
      computeSalaryForQuarter(
        "2026-04",
        new Map([
          ["2026-01", 1_400_000],
          ["2026-02", 1_400_000],
          ["2026-03", 1_400_000],
        ]),
        [],
      )!,
    );
    expect(snap.status).toBe("consult");
    expect(snap.appliedRate).toBeNull();
    expect(snap.salary).toBeNull();
    expect(snap.appliedBand).toBe("M");
  });

  it("固定額は率を null、給与を固定額にする", () => {
    const snap = toSnapshot(
      computeSalaryForQuarter(
        "2026-04",
        new Map([
          ["2026-01", 300_000],
          ["2026-02", 300_000],
          ["2026-03", 300_000],
        ]),
        [],
      )!,
    );
    expect(snap.status).toBe("fixed");
    expect(snap.appliedRate).toBeNull();
    expect(snap.salary).toBe(235_000);
    expect(snap.appliedBand).toBe("FIXED");
  });
});

describe("buildNextPeriodSnapshot", () => {
  it("月単価が無ければ null", () => {
    expect(buildNextPeriodSnapshot([], [])).toBeNull();
  });

  it("直前四半期の3ヶ月が揃わなければ null", () => {
    expect(
      buildNextPeriodSnapshot([pp("2026-01", 1_000_000)], []),
    ).toBeNull();
  });

  it("最新単価の属する四半期の次を適用四半期とし、calcSalary と一致する確定値を返す", () => {
    const prices = [
      pp("2026-01", 1_000_000),
      pp("2026-02", 1_000_000),
      pp("2026-03", 1_000_000),
    ];
    const snap = buildNextPeriodSnapshot(prices, []);
    expect(snap?.appliedFrom).toBe("2026-04");
    // 暫定ランク1
    expect(snap?.salary).toBe(calcSalary(prices, 1).salary);
    expect(snap?.salary).toBe(545_200);
  });

  it("入力順に依存せず最新月の四半期から適用四半期を決める", () => {
    const snap = buildNextPeriodSnapshot(
      [pp("2026-03", 500_000), pp("2026-01", 500_000), pp("2026-02", 500_000)],
      [],
    );
    expect(snap?.appliedFrom).toBe("2026-04");
  });

  it("適用月時点の評価ランクを反映する", () => {
    const prices = [
      pp("2026-01", 1_000_000),
      pp("2026-02", 1_000_000),
      pp("2026-03", 1_000_000),
    ];
    const ranks: RankHistoryEntry[] = [{ effectiveFrom: "2026-01", rank: 3 }];
    const snap = buildNextPeriodSnapshot(prices, ranks);
    expect(snap?.appliedRank).toBe(3);
    expect(snap?.appliedRate).toBe(57.26); // I帯ランク3
    expect(snap?.salary).toBe(calcSalary(prices, 3).salary);
  });

  it("確定済みスナップショットは後続の再計算に影響されない（当時の値を保持）", () => {
    const prices = [
      pp("2026-01", 1_000_000),
      pp("2026-02", 1_000_000),
      pp("2026-03", 1_000_000),
    ];
    const confirmed = buildNextPeriodSnapshot(prices, [
      { effectiveFrom: "2026-01", rank: 1 },
    ])!;
    const confirmedSalary = confirmed.salary;

    // 後からランク・単価を変えて再計算しても、保存済みオブジェクトは不変。
    const recalculated = buildNextPeriodSnapshot(
      [
        pp("2026-01", 1_200_000),
        pp("2026-02", 1_200_000),
        pp("2026-03", 1_200_000),
      ],
      [{ effectiveFrom: "2026-01", rank: 3 }],
    )!;

    expect(confirmed.salary).toBe(confirmedSalary);
    expect(confirmed.appliedRank).toBe(1);
    expect(confirmed.appliedBand).toBe("I");
    expect(recalculated.salary).not.toBe(confirmed.salary);
    expect(recalculated.appliedBand).toBe("K");
  });
});
