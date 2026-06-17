/**
 * 年月（"YYYY-MM"）の計算と、月単価・評価ランク履歴から
 * 各期の給与を組み立てるためのヘルパー。
 */

import {
  calcSalary,
  type PricePoint,
  type SalaryBreakdown,
  type SalaryStatus,
} from "./calc";
import type { Rank } from "./rateTable";

export interface RankHistoryEntry {
  /** 適用開始 "YYYY-MM" */
  effectiveFrom: string;
  rank: Rank;
}

const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidYearMonth(ym: string): boolean {
  return YM_RE.test(ym);
}

/** "YYYY-MM" を {year, month} に分解 */
function parseYM(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

/** {year, month} を "YYYY-MM" に整形 */
function formatYM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** 年月を n ヶ月ずらす（n は負も可） */
export function addMonths(ym: string, n: number): string {
  const { year, month } = parseYM(ym);
  // month は 1-12。0-index に直して計算する。
  const total = year * 12 + (month - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return formatYM(ny, nm);
}

/** ym より前の count ヶ月を古い順で返す（ym 自体は含まない） */
export function precedingMonths(ym: string, count: number): string[] {
  const result: string[] = [];
  for (let i = count; i >= 1; i--) {
    result.push(addMonths(ym, -i));
  }
  return result;
}

/** 2つの年月を比較（a < b なら負, a === b なら 0, a > b なら正） */
export function compareYM(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 今日（システム日付）の "YYYY-MM" */
export function currentYearMonth(now: Date = new Date()): string {
  return formatYM(now.getFullYear(), now.getMonth() + 1);
}

/**
 * 指定の年月時点で有効な評価ランクを返す。
 * 履歴がない、または対象月以前の履歴がない場合は fallback を返す。
 */
export function rankAt(
  history: RankHistoryEntry[],
  ym: string,
  fallback: Rank = 2,
): Rank {
  const applicable = history
    .filter((h) => compareYM(h.effectiveFrom, ym) <= 0)
    .sort((a, b) => compareYM(a.effectiveFrom, b.effectiveFrom));
  if (applicable.length === 0) return fallback;
  return applicable[applicable.length - 1].rank;
}

/**
 * 指定の年月時点の評価ランクが「暫定（未設定による fallback）」かどうかを返す。
 * 対象月以前に有効な履歴が1件もない場合は true（rankAt が fallback を返す条件と一致）。
 * 「本人が明示設定した値」と「暫定値」を区別するために使う（PRD §12.3）。
 */
export function isRankProvisional(
  history: RankHistoryEntry[],
  ym: string,
): boolean {
  return !history.some((h) => compareYM(h.effectiveFrom, ym) <= 0);
}

export interface SalaryResult {
  /** この給与が適用される最初の月 "YYYY-MM" */
  appliedFrom: string;
  /** 適用期間の表示（例: "2026-04 〜 2026-06"） */
  periodLabel: string;
  breakdown: SalaryBreakdown;
  /**
   * 適用された評価ランクが暫定（未設定による fallback）か。
   * 帯がランク不問（fixed/single/consult）でも「値の出所」として true になり得るため、
   * 表示側では `breakdown.band.kind === "rank"` と組み合わせて暫定注記の要否を判断する。
   */
  rankProvisional: boolean;
}

/**
 * 「appliedFrom 月から適用される給与」を、その直前3ヶ月の単価から計算する。
 * 直前3ヶ月の単価が揃っていない場合は null を返す。
 */
export function computeSalaryForAppliedMonth(
  appliedFrom: string,
  priceMap: Map<string, number>,
  rankHistory: RankHistoryEntry[],
  rankFallback: Rank = 2,
): SalaryResult | null {
  const sourceMonths = precedingMonths(appliedFrom, 3);
  const points: PricePoint[] = [];
  for (const ym of sourceMonths) {
    const price = priceMap.get(ym);
    if (price === undefined) return null; // 3ヶ月揃っていない
    points.push({ yearMonth: ym, unitPrice: price });
  }
  const rank = rankAt(rankHistory, appliedFrom, rankFallback);
  const breakdown = calcSalary(points, rank);
  return {
    appliedFrom,
    periodLabel: `${appliedFrom} 〜 ${addMonths(appliedFrom, 2)}`,
    breakdown,
    rankProvisional: isRankProvisional(rankHistory, appliedFrom),
  };
}

/**
 * 給与計算結果スナップショットの中身（PRD §9）。
 * `salary_results` テーブルに永続化するフィールドと一致させる。
 * 「いつ・どの帯・どのランク・どの率で計算したか」を後から追跡するための値で、
 * 早見表が改定されても保存時点の率・額をそのまま保持する。
 */
export interface SalarySnapshot {
  /** この給与が適用される最初の月 "YYYY-MM" */
  appliedFrom: string;
  avgUnitPrice: number;
  /** 判定された帯コード（例: "I", "A-0", "FIXED"） */
  appliedBand: string;
  appliedRank: Rank;
  /** 適用された還元率（％）。要相談/固定は null */
  appliedRate: number | null;
  /** 給与（総支給, 円）。要相談は null */
  salary: number | null;
  status: SalaryStatus;
}

/** 計算結果（SalaryResult）から永続化用スナップショットへ変換する。 */
export function toSnapshot(result: SalaryResult): SalarySnapshot {
  const b = result.breakdown;
  return {
    appliedFrom: result.appliedFrom,
    avgUnitPrice: b.avgUnitPrice,
    appliedBand: b.band.code,
    appliedRank: b.rank,
    appliedRate: b.rate,
    salary: b.salary,
    status: b.status,
  };
}

/**
 * 来期（最新の月単価の翌月から適用）の確定スナップショットを組み立てる。
 * 月単価が未登録、または直前3ヶ月が揃わず算出できない場合は null。
 * 単価/ランク保存時の永続化に使う。
 */
export function buildNextPeriodSnapshot(
  prices: PricePoint[],
  rankHistory: RankHistoryEntry[],
  rankFallback: Rank = 2,
): SalarySnapshot | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) =>
    compareYM(a.yearMonth, b.yearMonth),
  );
  const latest = sorted[sorted.length - 1].yearMonth;
  const appliedFrom = addMonths(latest, 1);
  const priceMap = new Map(prices.map((p) => [p.yearMonth, p.unitPrice]));
  const result = computeSalaryForAppliedMonth(
    appliedFrom,
    priceMap,
    rankHistory,
    rankFallback,
  );
  if (!result) return null;
  return toSnapshot(result);
}

/**
 * 給与の推移（履歴）を作る。
 * データのある全期間にわたり、直前3ヶ月が揃う各月について給与を計算して返す。
 * グラフ・一覧表示に使う（古い順）。
 */
export function buildSalaryHistory(
  prices: PricePoint[],
  rankHistory: RankHistoryEntry[],
  rankFallback: Rank = 2,
): SalaryResult[] {
  if (prices.length < 3) return [];
  const priceMap = new Map(prices.map((p) => [p.yearMonth, p.unitPrice]));
  const sorted = [...prices].sort((a, b) => compareYM(a.yearMonth, b.yearMonth));
  const first = sorted[0].yearMonth;
  const last = sorted[sorted.length - 1].yearMonth;

  // 給与が適用され得る最初の月は、最古データの3ヶ月後。
  // 最後は「最新データの翌月（来期）」まで。
  const start = addMonths(first, 3);
  const end = addMonths(last, 1);

  const results: SalaryResult[] = [];
  let cursor = start;
  while (compareYM(cursor, end) <= 0) {
    const r = computeSalaryForAppliedMonth(
      cursor,
      priceMap,
      rankHistory,
      rankFallback,
    );
    if (r) results.push(r);
    cursor = addMonths(cursor, 1);
  }
  return results;
}
