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
