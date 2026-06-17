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
  guidanceNote,
} from "./guidance";

/** 計算結果の区分 */
export type SalaryStatus =
  | "ok" // 通常計算（率 × 平均単価）
  | "fixed" // 固定額（40万円未満）
  | "consult"; // 要相談（140万円以上, 自動計算対象外）

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
 * 直近3ヶ月の単価と評価ランクから給与（総支給）を計算する。
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

export type { RateBand, Rank };
