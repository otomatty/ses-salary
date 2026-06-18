/**
 * 年月（"YYYY-MM"）の計算と、月単価・評価ランク履歴から
 * 各期の給与を組み立てるためのヘルパー。
 *
 * 給与は「四半期（1〜3 / 4〜6 / 7〜9 / 10〜12月）」単位で決まる。
 * ある四半期の平均単価が、その**次の四半期**の給与の基準になる。
 * 例: 4〜6月の平均単価 → 7〜9月の給与。
 */

import {
  calcSalary,
  buildDebutBreakdown,
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

/** 一括入力で一度に登録できる最大月数（UI・サーバで共有する業務上の上限）。 */
export const BULK_MAX_MONTHS = 120;

/**
 * start から end まで（両端含む）の連続した年月を古い順で返す。
 * end が start より前なら空配列。一括入力で範囲を月リストへ展開するのに使う。
 *
 * 範囲が長すぎる場合に黙って切り捨てると、UI が「一部だけ保存して成功」扱いに
 * なってしまう（指定した終了月が保存されない）。そのため業務上の上限
 * {@link BULK_MAX_MONTHS} では切らず、実際の月数をそのまま返す（上限超過は
 * 呼び出し側で検証・拒否する）。壊れた入力での暴走だけは十分大きい安全上限で防ぐ。
 */
export function monthRange(start: string, end: string): string[] {
  if (compareYM(start, end) > 0) return [];
  const result: string[] = [];
  let cursor = start;
  // 安全上限（不正・壊れた入力での無限ループ防止）。業務上の上限よりはるかに大きい。
  const HARD_CAP = 1200; // 100年分
  for (let i = 0; i < HARD_CAP && compareYM(cursor, end) <= 0; i++) {
    result.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return result;
}

/**
 * 指定の年月が属する四半期の開始月（"YYYY-MM"）を返す。
 * Q1=1月, Q2=4月, Q3=7月, Q4=10月。
 */
export function quarterStartMonth(ym: string): string {
  const { year, month } = parseYM(ym);
  const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return formatYM(year, startMonth);
}

/** 四半期の開始月から、その四半期に含まれる3ヶ月を古い順で返す。 */
export function quarterMonths(quarterStart: string): string[] {
  const start = quarterStartMonth(quarterStart);
  return [start, addMonths(start, 1), addMonths(start, 2)];
}

/** 直前の四半期の開始月を返す。 */
export function prevQuarterStart(quarterStart: string): string {
  return quarterStartMonth(addMonths(quarterStartMonth(quarterStart), -3));
}

/** 次の四半期の開始月を返す。 */
export function nextQuarterStart(quarterStart: string): string {
  return quarterStartMonth(addMonths(quarterStartMonth(quarterStart), 3));
}

/** 四半期の表示ラベル（例: "2026-07 〜 2026-09"）。 */
export function quarterLabel(quarterStart: string): string {
  const start = quarterStartMonth(quarterStart);
  return `${start} 〜 ${addMonths(start, 2)}`;
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
  fallback: Rank = 1,
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
  /** この給与が適用される四半期の最初の月 "YYYY-MM"（例: 7〜9月期なら "2026-07"） */
  appliedFrom: string;
  /** 適用四半期の表示（例: "2026-07 〜 2026-09"） */
  periodLabel: string;
  breakdown: SalaryBreakdown;
  /**
   * 適用された評価ランクが暫定（未設定による fallback）か。
   * 帯がランク不問（fixed/single/consult）でも「値の出所」として true になり得るため、
   * 表示側では `breakdown.band.kind === "rank"` と組み合わせて暫定注記の要否を判断する。
   */
  rankProvisional: boolean;
}

/** priceMap に登録された最古の年月（"YYYY-MM"）。空なら null。 */
function earliestMonth(priceMap: Map<string, number>): string | null {
  let min: string | null = null;
  for (const ym of priceMap.keys()) {
    if (min === null || ym < min) min = ym;
  }
  return min;
}

/**
 * 「指定四半期に適用される給与」を、その**直前の四半期**の平均単価から計算する。
 * @param quarterStart 適用四半期の開始月（"YYYY-MM"。四半期内の任意の月でも開始月に正規化する）
 *
 * 算出ルール（PRD 別紙）:
 * - 直前四半期の3ヶ月すべての単価が揃う → 還元率方式（calcSalary）。
 * - 直前四半期が「デビュー四半期」で、第2月／第3月にデビュー（＝月初より後に最初の単価が
 *   付き、そこから四半期末まで連続して単価がある）→ デビュー特例（一律 235,000 円）。
 * - それ以外で3ヶ月が揃わない（データ不足・歯抜け）→ null（算出不能・入力待ち）。
 */
export function computeSalaryForQuarter(
  quarterStart: string,
  priceMap: Map<string, number>,
  rankHistory: RankHistoryEntry[],
  rankFallback: Rank = 1,
): SalaryResult | null {
  const targetStart = quarterStartMonth(quarterStart);
  const sourceQuarterStart = prevQuarterStart(targetStart);
  const sourceMonths = quarterMonths(sourceQuarterStart);
  const points: PricePoint[] = [];
  for (const ym of sourceMonths) {
    const price = priceMap.get(ym);
    if (price !== undefined) points.push({ yearMonth: ym, unitPrice: price });
  }

  // 3ヶ月すべて揃う → 通常の還元率方式。
  if (points.length === sourceMonths.length) {
    const rank = rankAt(rankHistory, targetStart, rankFallback);
    return {
      appliedFrom: targetStart,
      periodLabel: quarterLabel(targetStart),
      breakdown: calcSalary(points, rank),
      rankProvisional: isRankProvisional(rankHistory, targetStart),
    };
  }

  // 揃っていない場合、デビュー四半期（途中デビュー）かどうかを判定する。
  if (points.length > 0 && isMidQuarterDebut(points, sourceMonths, priceMap)) {
    return {
      appliedFrom: targetStart,
      periodLabel: quarterLabel(targetStart),
      breakdown: buildDebutBreakdown(points),
      // デビュー特例はランク不問のため暫定扱いにはしない。
      rankProvisional: false,
    };
  }

  // それ以外（単なるデータ不足・歯抜け）は算出不能。
  return null;
}

/**
 * 直前四半期が「四半期の途中（第2月・第3月）でデビュー/入社した四半期」かどうか。
 * 条件:
 *  - この四半期に付いた最初の単価が、全データ中の最古月（＝デビュー月）と一致する
 *  - その最初の単価月が四半期の第1月より後（＝月初より後にデビュー）
 *  - 最初の単価月から四半期末まで、単価が連続して登録されている（歯抜けでない）
 */
function isMidQuarterDebut(
  points: PricePoint[],
  sourceMonths: string[],
  priceMap: Map<string, number>,
): boolean {
  const firstPresent = points[0].yearMonth; // points は sourceMonths 順
  const globalEarliest = earliestMonth(priceMap);
  if (firstPresent !== globalEarliest) return false; // この四半期がデビュー四半期でない
  if (firstPresent === sourceMonths[0]) return false; // 第1月デビュー（途中ではない）
  // 最初の単価月以降が四半期末まで連続して揃っているか。
  const trailing = sourceMonths.filter((ym) => ym >= firstPresent);
  return (
    trailing.length === points.length &&
    trailing.every((ym) => priceMap.has(ym))
  );
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
 * 来期（最新単価が属する四半期の、次の四半期から適用）の確定スナップショットを組み立てる。
 * 月単価が未登録、または直前四半期の3ヶ月が揃わず算出できない場合は null。
 * 単価/ランク保存時の永続化に使う。
 */
export function buildNextPeriodSnapshot(
  prices: PricePoint[],
  rankHistory: RankHistoryEntry[],
  rankFallback: Rank = 1,
): SalarySnapshot | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) =>
    compareYM(a.yearMonth, b.yearMonth),
  );
  const latest = sorted[sorted.length - 1].yearMonth;
  // 最新単価が属する四半期の平均が、その次の四半期の給与になる。
  const targetQuarter = nextQuarterStart(quarterStartMonth(latest));
  const priceMap = new Map(prices.map((p) => [p.yearMonth, p.unitPrice]));
  const result = computeSalaryForQuarter(
    targetQuarter,
    priceMap,
    rankHistory,
    rankFallback,
  );
  if (!result) return null;
  return toSnapshot(result);
}

/**
 * 給与の推移（履歴）を作る。
 * データのある全期間にわたり、直前四半期が揃う各四半期について給与を計算して返す。
 * グラフ・一覧表示に使う（古い順）。
 */
export function buildSalaryHistory(
  prices: PricePoint[],
  rankHistory: RankHistoryEntry[],
  rankFallback: Rank = 1,
): SalaryResult[] {
  // デビュー特例（1〜2ヶ月のみ）でも給与が出るため、空でなければ走査する。
  // 算出不能な四半期は computeSalaryForQuarter が null を返してスキップされる。
  if (prices.length === 0) return [];
  const priceMap = new Map(prices.map((p) => [p.yearMonth, p.unitPrice]));
  const sorted = [...prices].sort((a, b) => compareYM(a.yearMonth, b.yearMonth));
  const first = sorted[0].yearMonth;
  const last = sorted[sorted.length - 1].yearMonth;

  // 給与が適用され得る最初の四半期は、最古データの四半期の次。
  // 最後は「最新データの四半期の次（来期）」まで。
  const start = nextQuarterStart(quarterStartMonth(first));
  const end = nextQuarterStart(quarterStartMonth(last));

  const results: SalaryResult[] = [];
  let cursor = start;
  while (compareYM(cursor, end) <= 0) {
    const r = computeSalaryForQuarter(
      cursor,
      priceMap,
      rankHistory,
      rankFallback,
    );
    if (r) results.push(r);
    cursor = nextQuarterStart(cursor);
  }
  return results;
}
