/**
 * 早見表マスタ（還元率テーブル）
 *
 * PRD §7 の表を忠実に反映する会社共通の固定マスタ。
 * 各帯の枝番 -1 / -2 / -3 は評価ランク 1 / 2 / 3 に対応する。
 *
 * 注意: 低単価帯（E など）では率が単調増加しない箇所があるが、
 * これは会社の早見表どおりであり意図的にそのまま採用している。
 * 改定時はこのファイル（およびマイグレーション seed）を更新する。
 */

export type Rank = 1 | 2 | 3;

/** 帯の種別 */
export type BandKind =
  | "rank" // 評価ランクごとに還元率が異なる通常の帯
  | "single" // 枝番なしの単一還元率（A-0 / A-1）
  | "fixed" // 率ではなく固定額（40万円未満）
  | "consult"; // 自動計算対象外（140万円以上 = 要相談）

export interface RateBand {
  /** 帯コード（例: "I", "A-0", "FIXED", "M"） */
  code: string;
  /** 表示用ラベル */
  label: string;
  /** 単価下限（円, この値を含む） */
  min: number;
  /** 単価上限（円, この値を含む）。上限なしは null */
  max: number | null;
  kind: BandKind;
  /** kind === "rank" のとき: 評価ランク別の還元率（％） */
  rates?: Record<Rank, number>;
  /** kind === "single" のとき: 単一還元率（％） */
  rate?: number;
  /** kind === "fixed" のとき: 固定額（円） */
  fixedAmount?: number;
}

/**
 * 帯の定義。単価の高い順に並べる（判定は上から走査する）。
 */
export const RATE_BANDS: RateBand[] = [
  {
    code: "M",
    label: "M（要相談）",
    min: 1_400_000,
    max: null,
    kind: "consult",
  },
  {
    code: "L",
    label: "L",
    min: 1_300_000,
    max: 1_399_999,
    kind: "rank",
    rates: { 1: 56.34, 2: 57.71, 3: 59.08 },
  },
  {
    code: "K",
    label: "K",
    min: 1_200_000,
    max: 1_299_999,
    kind: "rank",
    rates: { 1: 55.74, 2: 57.11, 3: 58.48 },
  },
  {
    code: "J",
    label: "J",
    min: 1_100_000,
    max: 1_199_999,
    kind: "rank",
    rates: { 1: 55.13, 2: 56.51, 3: 57.88 },
  },
  {
    code: "I",
    label: "I",
    min: 1_000_000,
    max: 1_099_999,
    kind: "rank",
    rates: { 1: 54.52, 2: 55.89, 3: 57.26 },
  },
  {
    code: "H",
    label: "H",
    min: 900_000,
    max: 999_999,
    kind: "rank",
    rates: { 1: 53.88, 2: 55.26, 3: 56.63 },
  },
  {
    code: "G",
    label: "G",
    min: 800_000,
    max: 899_999,
    kind: "rank",
    rates: { 1: 53.23, 2: 54.6, 3: 55.98 },
  },
  {
    code: "F",
    label: "F",
    min: 700_000,
    max: 799_999,
    kind: "rank",
    rates: { 1: 52.55, 2: 53.92, 3: 55.29 },
  },
  {
    code: "E",
    label: "E",
    min: 650_000,
    max: 699_999,
    kind: "rank",
    rates: { 1: 52.58, 2: 54.02, 3: 55.37 },
  },
  {
    code: "D",
    label: "D",
    min: 600_000,
    max: 649_999,
    kind: "rank",
    rates: { 1: 52.45, 2: 53.89, 3: 55.26 },
  },
  {
    code: "C",
    label: "C",
    min: 550_000,
    max: 599_999,
    kind: "rank",
    rates: { 1: 52.27, 2: 53.73, 3: 55.1 },
  },
  {
    code: "B",
    label: "B",
    min: 500_000,
    max: 549_999,
    kind: "rank",
    rates: { 1: 52.01, 2: 53.47, 3: 54.83 },
  },
  {
    code: "A-1",
    label: "A-1（単一）",
    min: 450_000,
    max: 499_999,
    kind: "single",
    rate: 54.45,
  },
  {
    code: "A-0",
    label: "A-0（単一）",
    min: 400_000,
    max: 449_999,
    kind: "single",
    rate: 55.0,
  },
  {
    code: "FIXED",
    label: "固定額",
    min: 0,
    max: 399_999,
    kind: "fixed",
    fixedAmount: 235_000,
  },
];

/**
 * 平均単価から該当する帯を判定する。
 * 範囲外（負の値など）の場合は最下位帯（FIXED）を返す。
 */
export function findBand(avgUnitPrice: number): RateBand {
  for (const band of RATE_BANDS) {
    const aboveMin = avgUnitPrice >= band.min;
    const belowMax = band.max === null || avgUnitPrice <= band.max;
    if (aboveMin && belowMax) return band;
  }
  // 理論上ここには到達しない（FIXED が min:0 で全てを拾う）
  return RATE_BANDS[RATE_BANDS.length - 1];
}

/**
 * Tech ランク制度のティア（格付け）。
 * 還元率テーブルの帯（A〜M）とは別に、単価そのものを Gold / Silver / Bronze の
 * 3段階で表す「見た目の格」。視覚的な特別感を出すための表示用区分。
 */
export type Tier = "gold" | "silver" | "bronze";

/** 表示順（高い順）。凡例やグルーピングで使う。 */
export const TIER_ORDER: Tier[] = ["gold", "silver", "bronze"];

/** ティアの下限（円）。スライド「ランク制度の導入」の単価帯に対応する。 */
export const TIER_GOLD_MIN = 900_000;
export const TIER_SILVER_MIN = 600_000;

export interface TierInfo {
  tier: Tier;
  /** 正式名称（例: "Tech Gold"） */
  label: string;
  /** 短縮名（例: "Gold"） */
  short: string;
  /** 単価レンジの説明（例: "単価 90万円〜"） */
  rangeLabel: string;
}

export const TIERS: Record<Tier, TierInfo> = {
  gold: {
    tier: "gold",
    label: "Tech Gold",
    short: "Gold",
    rangeLabel: "単価 90万円〜",
  },
  silver: {
    tier: "silver",
    label: "Tech Silver",
    short: "Silver",
    rangeLabel: "単価 60〜89.9万円",
  },
  bronze: {
    tier: "bronze",
    label: "Tech Bronze",
    short: "Bronze",
    rangeLabel: "単価 〜59.9万円",
  },
};

/**
 * 単価（円）から Tech ランクのティアを判定する。
 * 境界（90万 / 60万）は還元率テーブルの帯境界（H / D）と一致する。
 */
export function findTier(unitPrice: number): Tier {
  if (unitPrice >= TIER_GOLD_MIN) return "gold";
  if (unitPrice >= TIER_SILVER_MIN) return "silver";
  return "bronze";
}

/** 帯が属するティア（早見表のグルーピング用）。帯下限で判定する。 */
export function tierForBand(band: RateBand): Tier {
  return findTier(band.min);
}

/**
 * 月単価の配列から最新月（年月の降順で先頭）の単価を返す。
 * エントリが無ければ null。個人の現在ティア判定に使う。
 */
export function latestUnitPrice(
  prices: { yearMonth: string; unitPrice: number }[],
): number | null {
  if (prices.length === 0) return null;
  // "YYYY-MM" は辞書順 = 時系列順。
  return prices.reduce((a, b) => (b.yearMonth > a.yearMonth ? b : a)).unitPrice;
}

/**
 * 月単価の配列から指定月（"YYYY-MM"）の単価を返す。
 * その月の単価が未登録なら null。今月の単価でのティア判定に使う。
 */
export function unitPriceForMonth(
  prices: { yearMonth: string; unitPrice: number }[],
  yearMonth: string,
): number | null {
  const match = prices.find((p) => p.yearMonth === yearMonth);
  return match ? match.unitPrice : null;
}
