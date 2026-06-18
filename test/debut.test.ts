import { describe, it, expect } from "vitest";
import {
  buildDebutBreakdown,
  manYenToYen,
  yenToManYen,
  formatManYen,
  type PricePoint,
} from "../src/shared/calc";
import {
  computeSalaryForQuarter,
  buildSalaryHistory,
  buildNextPeriodSnapshot,
  monthRange,
  BULK_MAX_MONTHS,
} from "../src/shared/periods";
import { DEBUT_AMOUNT, guidanceNote } from "../src/shared/guidance";

function pp(yearMonth: string, unitPrice: number): PricePoint {
  return { yearMonth, unitPrice };
}

describe("万円⇄円の変換", () => {
  it("manYenToYen は万円を円へ変換する", () => {
    expect(manYenToYen(80)).toBe(800_000);
    expect(manYenToYen(80.5)).toBe(805_000);
    expect(manYenToYen(0)).toBe(0);
  });

  it("yenToManYen は円を万円へ変換する", () => {
    expect(yenToManYen(800_000)).toBe(80);
    expect(yenToManYen(805_000)).toBe(80.5);
  });

  it("formatManYen は端数があるときだけ小数表示にする", () => {
    expect(formatManYen(800_000)).toBe("80万円");
    expect(formatManYen(805_000)).toBe("80.5万円");
    expect(formatManYen(235_000)).toBe("23.5万円");
  });
});

describe("monthRange", () => {
  it("両端を含む連続月を古い順で返す", () => {
    expect(monthRange("2026-04", "2026-06")).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
  });

  it("単月・年跨ぎを扱う", () => {
    expect(monthRange("2026-12", "2027-02")).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(monthRange("2026-04", "2026-04")).toEqual(["2026-04"]);
  });

  it("終了が開始より前なら空", () => {
    expect(monthRange("2026-06", "2026-04")).toEqual([]);
  });

  it("業務上の上限（120ヶ月）を超える範囲も切り捨てず実数を返す", () => {
    // 2020-01〜2030-01 は 121ヶ月。黙って 120 に丸めない（呼び出し側が拒否できるように）。
    const range = monthRange("2020-01", "2030-01");
    expect(range.length).toBe(121);
    expect(range.length).toBeGreaterThan(BULK_MAX_MONTHS);
    expect(range[0]).toBe("2020-01");
    expect(range[range.length - 1]).toBe("2030-01");
  });
});

describe("buildDebutBreakdown", () => {
  it("単価が1〜2ヶ月分でも一律 235,000 円・status=debut を返す", () => {
    const b = buildDebutBreakdown([pp("2026-02", 500_000), pp("2026-03", 500_000)]);
    expect(b.status).toBe("debut");
    expect(b.salary).toBe(DEBUT_AMOUNT);
    expect(b.salary).toBe(235_000);
    expect(b.rate).toBeNull();
    expect(b.band.code).toBe("FIXED");
    expect(b.note).toBe(guidanceNote("debut"));
  });
});

describe("四半期途中のデビュー/入社（computeSalaryForQuarter）", () => {
  // 資料 p.19 の例: デビュー四半期は 235,000 円（レンジ評価なし）。
  it("第2月デビュー（単価2ヶ月）→ 翌四半期は 235,000 円", () => {
    const priceMap = new Map([
      ["2026-02", 500_000],
      ["2026-03", 500_000],
    ]);
    const r = computeSalaryForQuarter("2026-04", priceMap, []);
    expect(r?.breakdown.status).toBe("debut");
    expect(r?.breakdown.salary).toBe(235_000);
    expect(r?.appliedFrom).toBe("2026-04");
  });

  it("第3月デビュー（単価1ヶ月）→ 翌四半期は 235,000 円", () => {
    const priceMap = new Map([["2026-03", 500_000]]);
    const r = computeSalaryForQuarter("2026-04", priceMap, []);
    expect(r?.breakdown.status).toBe("debut");
    expect(r?.breakdown.salary).toBe(235_000);
  });

  it("第3月デビューで第2月が待機（歯抜けでなく月初より後の連続）でも 235,000 円", () => {
    // 第1月・第2月は単価なし（アカデミア/待機）、第3月のみ単価 → デビュー特例。
    const priceMap = new Map([["2026-03", 600_000]]);
    const r = computeSalaryForQuarter("2026-04", priceMap, []);
    expect(r?.breakdown.status).toBe("debut");
  });

  it("第1月デビュー（3ヶ月そろう）→ 通常の還元率計算になる", () => {
    const priceMap = new Map([
      ["2026-01", 1_000_000],
      ["2026-02", 1_000_000],
      ["2026-03", 1_000_000],
    ]);
    const r = computeSalaryForQuarter("2026-04", priceMap, []);
    expect(r?.breakdown.status).toBe("ok");
    expect(r?.breakdown.band.code).toBe("I");
  });

  it("月初(第1月)からのデータで3ヶ月そろわない → デビューではなく入力待ち(null)", () => {
    // 第1月から単価があるのに第3月が無いのは、デビューではなく単なるデータ不足。
    const priceMap = new Map([
      ["2026-01", 1_000_000],
      ["2026-02", 1_000_000],
    ]);
    expect(computeSalaryForQuarter("2026-04", priceMap, [])).toBeNull();
  });

  it("デビュー四半期より後の歯抜けはデビュー特例にならない(null)", () => {
    // Q1 は3ヶ月そろう（通常）。Q2 が2ヶ月だけ → デビューではなく入力待ち。
    const priceMap = new Map([
      ["2026-01", 600_000],
      ["2026-02", 600_000],
      ["2026-03", 600_000],
      ["2026-05", 700_000],
      ["2026-06", 700_000],
    ]);
    // Q3(2026-07) は直前 Q2(04..06) を見る。04 が無く 05,06 のみ → null。
    expect(computeSalaryForQuarter("2026-07", priceMap, [])).toBeNull();
  });
});

describe("buildSalaryHistory（デビュー含む）", () => {
  it("デビュー四半期の翌四半期に 235,000 円の履歴が出る", () => {
    // 第2月デビュー: 2026-02, 2026-03 の2ヶ月のみ。
    const prices = [pp("2026-02", 500_000), pp("2026-03", 500_000)];
    const history = buildSalaryHistory(prices, []);
    expect(history).toHaveLength(1);
    expect(history[0].appliedFrom).toBe("2026-04");
    expect(history[0].breakdown.status).toBe("debut");
    expect(history[0].breakdown.salary).toBe(235_000);
  });

  it("デビュー後にフル四半期が続くと、デビュー特例→通常計算へ切り替わる", () => {
    // 2026-03 デビュー（Q1）、その後 Q2(04-06) フル稼働。
    const prices = [
      pp("2026-03", 600_000),
      pp("2026-04", 600_000),
      pp("2026-05", 600_000),
      pp("2026-06", 600_000),
    ];
    const history = buildSalaryHistory(prices, []);
    const byMonth = new Map(history.map((r) => [r.appliedFrom, r]));
    // Q2(2026-04): 直前 Q1 はデビュー四半期(単価1ヶ月) → デビュー特例 235,000。
    expect(byMonth.get("2026-04")?.breakdown.status).toBe("debut");
    // Q3(2026-07): 直前 Q2 は3ヶ月そろう → 通常計算。
    expect(byMonth.get("2026-07")?.breakdown.status).toBe("ok");
    expect(byMonth.get("2026-07")?.breakdown.band.code).toBe("D");
  });
});

describe("buildNextPeriodSnapshot（デビュー）", () => {
  it("デビュー四半期のスナップショットは status=debut・固定額になる", () => {
    const snap = buildNextPeriodSnapshot(
      [pp("2026-02", 500_000), pp("2026-03", 500_000)],
      [],
    );
    expect(snap?.appliedFrom).toBe("2026-04");
    expect(snap?.status).toBe("debut");
    expect(snap?.salary).toBe(235_000);
    expect(snap?.appliedRate).toBeNull();
    expect(snap?.appliedBand).toBe("FIXED");
  });
});
