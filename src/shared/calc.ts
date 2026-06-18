/**
 * 給与計算の核心ロジック（PRD §6.2 / §11）。
 *
 * 透明性が最優先のため、サーバ・クライアント双方でこの同一モジュールを使い、
 * 計算過程（対象3ヶ月・平均・帯・ランク・率・式）を結果に含める。
 */

import { findBand, type RateBand, type Rank } from "./rateTable";
import {
  formatConsultFormula,
  formatFixedFormula,
  formatDebutFormula,
  guidanceNote,
} from "./guidance";

/** 計算結果の区分 */
export type SalaryStatus =
  | "ok" // 通常計算（率 × 平均単価）
  | "fixed" // 固定額（40万円未満）
  | "consult" // 要相談（140万円以上, 自動計算対象外）
  | "debut"; // デビュー特例（四半期の途中でデビュー/入社し、対象四半期の単価が揃わない）

export interface PricePoint {
  /** "YYYY-MM" */
  yearMonth: string;
  /** 月単価（円） */
  unitPrice: number;
}

export interface SalaryBreakdown {
  /** 計算に使った対象3ヶ月 */
  months: PricePoint[];
  /** 平均単価（円, 四捨五入後） */
  avgUnitPrice: number;
  /** 適用された評価ランク */
  rank: Rank;
  /** 判定された帯 */
  band: RateBand;
  status: SalaryStatus;
  /** 適用された還元率（％）。要相談の場合は null */
  rate: number | null;
  /** 給与（総支給, 円）。要相談の場合は null */
  salary: number | null;
  /** 検算用の計算式テキスト */
  formula: string;
  /** 補足メッセージ（要相談・固定額・単一レート 等） */
  note: string | null;
}

/** 円表示用フォーマッタ */
export function formatYen(value: number): string {
  return value.toLocaleString("ja-JP");
}

/** 1万円 = 10,000 円。単価入力は「万円単位」で行う（UI 用）。 */
export const MAN_YEN = 10_000;

/** 万円 → 円。例: 80（万円） → 800,000（円） */
export function manYenToYen(manYen: number): number {
  return Math.round(manYen * MAN_YEN);
}

/** 円 → 万円。例: 800,000（円） → 80（万円）。割り切れない端数は小数で返す。 */
export function yenToManYen(yen: number): number {
  return yen / MAN_YEN;
}

/**
 * 円を「◯◯万円」表記にする。端数（万円未満）がある場合のみ小数で表示する。
 * 例: 800,000 → "80万円", 805,000 → "80.5万円"
 */
export function formatManYen(yen: number): string {
  const man = yen / MAN_YEN;
  const text = Number.isInteger(man)
    ? String(man)
    : man.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
  return `${text}万円`;
}

/** 還元率の表示（％, 小数2桁） */
export function formatRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

/**
 * 単純平均を四捨五入して円単位で返す。
 */
export function averageUnitPrice(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sum = prices.reduce((a, b) => a + b, 0);
  return Math.round(sum / prices.length);
}

/**
 * 対象期間（四半期=3ヶ月）の単価と評価ランクから給与（総支給）を計算する。
 *
 * @param months 対象3ヶ月（古い順でも新しい順でも可。表示用にそのまま保持する）
 * @param rank   適用する評価ランク（1/2/3）
 */
export function calcSalary(months: PricePoint[], rank: Rank): SalaryBreakdown {
  const avg = averageUnitPrice(months.map((m) => m.unitPrice));
  const band = findBand(avg);

  // 要相談（140万円以上）
  if (band.kind === "consult") {
    return {
      months,
      avgUnitPrice: avg,
      rank,
      band,
      status: "consult",
      rate: null,
      salary: null,
      formula: formatConsultFormula(avg),
      note: guidanceNote("consult"),
    };
  }

  // 固定額（40万円未満）
  if (band.kind === "fixed") {
    const salary = band.fixedAmount ?? 0;
    return {
      months,
      avgUnitPrice: avg,
      rank,
      band,
      status: "fixed",
      rate: null,
      salary,
      formula: formatFixedFormula(avg, salary),
      note: guidanceNote("fixed"),
    };
  }

  // 単一レート（A-0 / A-1, 評価ランク不問）
  if (band.kind === "single") {
    const rate = band.rate ?? 0;
    const salary = Math.round((avg * rate) / 100);
    return {
      months,
      avgUnitPrice: avg,
      rank,
      band,
      status: "ok",
      rate,
      salary,
      formula: `${formatYen(avg)} × ${formatRate(rate)} = ${formatYen(salary)}`,
      note: `${band.code} 帯は枝番なしの単一レートのため、評価ランクに関わらず ${formatRate(
        rate,
      )} が適用されます。`,
    };
  }

  // 通常帯（評価ランク別の還元率）
  const rate = band.rates?.[rank] ?? 0;
  const salary = Math.round((avg * rate) / 100);
  return {
    months,
    avgUnitPrice: avg,
    rank,
    band,
    status: "ok",
    rate,
    salary,
    formula: `${formatYen(avg)} × ${formatRate(rate)} = ${formatYen(salary)}`,
    note: null,
  };
}

/**
 * デビュー特例の内訳を組み立てる（PRD 別紙「四半期の途中でデビューした場合」）。
 *
 * 四半期の途中（第2月・第3月）でエンジニアデビュー／入社すると、その四半期は
 * 3ヶ月分の案件単価が揃わない。資料では、このデビュー四半期を基準とする
 * （＝直後の）四半期の給与は還元率方式ではなく一律 235,000 円（アカデミア相当）と
 * 定められている。揃った単価が1〜2ヶ月分しか無くても算出できるようにする。
 *
 * @param presentMonths 当該四半期で単価が登録されている月（1〜2件想定。表示用に保持）
 */
export function buildDebutBreakdown(presentMonths: PricePoint[]): SalaryBreakdown {
  const avg = averageUnitPrice(presentMonths.map((m) => m.unitPrice));
  // デビュー特例の支給額は固定額帯（40万円未満）と同額の一律 235,000 円。
  const band = findBand(0);
  const salary = band.fixedAmount ?? 0;
  return {
    months: presentMonths,
    avgUnitPrice: avg,
    rank: 1,
    band,
    status: "debut",
    rate: null,
    salary,
    formula: formatDebutFormula(presentMonths.length, salary),
    note: guidanceNote("debut"),
  };
}

export type { RateBand, Rank };
