/**
 * 単価シミュレーション（試算）のための純関数（PRD §5.2 Should）。
 *
 * 「未来の給与期」を1つ選び、その直前四半期の月単価から給与を試算する。
 * 実績月の単価は固定で反映し、未実績月のみ仮単価を入力する。
 * 試算結果（SalaryResult）の組み立ては periods.computeSalaryForQuarterWithRank に
 * 一本化し、ここでは「現在の見込みとの差分」のみを担う。DB には一切書き込まない。
 */

import type { SalaryBreakdown } from "./calc";

export interface SimulationDiff {
  /** 比較対象（現在の予測）。無い場合は null */
  baseline: SalaryBreakdown | null;
  /** 給与差額（円）。どちらかが要相談(null)なら null */
  salaryDelta: number | null;
  /** 帯コードが変化したか */
  bandChanged: boolean;
  /** 評価ランクが変化したか */
  rankChanged: boolean;
}

/**
 * 試算結果と現在の予測（baseline）の差分を求める。
 * 差額・帯の変化・ランクの変化を返す。
 */
export function diffSimulation(
  baseline: SalaryBreakdown | null,
  sim: SalaryBreakdown,
): SimulationDiff {
  if (!baseline) {
    return {
      baseline: null,
      salaryDelta: null,
      bandChanged: false,
      rankChanged: false,
    };
  }
  const salaryDelta =
    baseline.salary !== null && sim.salary !== null
      ? sim.salary - baseline.salary
      : null;
  return {
    baseline,
    salaryDelta,
    bandChanged: baseline.band.code !== sim.band.code,
    rankChanged: baseline.rank !== sim.rank,
  };
}
