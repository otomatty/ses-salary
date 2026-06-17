/**
 * 自動計算対象外・特例ケースの利用者向け案内文言（PRD §12.4）。
 *
 * 「要相談（140万円以上）」「固定額（40万円未満）」のように自動計算が
 * 通常どおり働かないケースについて、
 *   - なぜ自動計算（または還元率方式）が適用されないのか（理由）
 *   - 利用者が次に何をすべきか（行動）
 * を一貫した表現で伝えるため、文言はこのモジュールに集約する。
 * ホーム・計算根拠・推移グラフなど全画面でここを参照し、表現を揃える。
 *
 * 連絡先（窓口名・問い合わせ先）は運用に合わせて {@link SALARY_CONTACT} を編集する。
 * 金額のしきい値・固定額は早見表マスタ（rateTable）から導出するため、
 * 早見表を改定すれば案内文言も自動的に追随する。
 */

import { RATE_BANDS, type BandKind, type RateBand } from "./rateTable";

/** calc と UI で共有する給与計算結果の区分 */
export type GuidanceStatus = "ok" | "fixed" | "consult";

/**
 * 給与の個別相談・問い合わせ窓口。
 *
 * 最終的な窓口名・連絡先は運用に合わせて確定する（PRD §12.4 未決事項）。
 * `contact` を設定すると、案内文に「（連絡先: …）」として併記される。
 */
export const SALARY_CONTACT = {
  /** 相談窓口の呼称（例: 「人事担当」「所属マネージャー」） */
  desk: "人事担当または所属マネージャー",
  /** 問い合わせ先（メール・チャンネル等）。未設定（null）なら窓口名のみ案内する。 */
  contact: null as string | null,
};

/** 特例ケースの案内に必要な要素一式。 */
export interface SalaryGuidance {
  /** バッジ等に使う短いラベル（例: 「要相談」） */
  badge: string;
  /** 1行サマリ（見出し） */
  headline: string;
  /** なぜ自動計算（還元率方式）が適用されないのか */
  reason: string;
  /** 利用者が次に取るべき行動 */
  nextAction: string;
}

function requireBand(kind: BandKind): RateBand {
  const band = RATE_BANDS.find((b) => b.kind === kind);
  if (!band) {
    throw new Error(`RATE_BANDS に kind="${kind}" の帯が定義されていません`);
  }
  return band;
}

const consultBand = requireBand("consult");
const fixedBand = requireBand("fixed");
/** 還元率方式が始まる平均単価の下限（固定額帯の直上 = A-0 帯の min） */
const rateFloorBand = RATE_BANDS.find((b) => b.code === "A-0");

/** 要相談となる平均単価のしきい値（円, この値以上）。 */
export const CONSULT_THRESHOLD = consultBand.min;
/** 固定額（円）。 */
export const FIXED_AMOUNT = fixedBand.fixedAmount ?? 0;
/** 固定額が適用される上限（円, この値未満で固定額）。 */
export const FIXED_UPPER = rateFloorBand?.min ?? 400_000;

/** 推移グラフの要相談マーカー系列名。 */
export const CONSULT_CHART_SERIES = "要相談（自動計算外）";

function yen(value: number): string {
  return value.toLocaleString("ja-JP");
}

function contactSuffix(): string {
  return SALARY_CONTACT.contact ? `（連絡先: ${SALARY_CONTACT.contact}）` : "";
}

/** 要相談（140万円以上 / 自動計算対象外）の案内。 */
export const CONSULT_GUIDANCE: SalaryGuidance = {
  badge: "要相談",
  headline: "給与は自動計算の対象外です",
  reason: `平均単価が ${yen(
    CONSULT_THRESHOLD,
  )} 円以上の場合、この給与体系では金額を一意に決められないため、自動計算の対象外になります。高単価帯の給与は会社との個別相談で決定します。`,
  nextAction: `次の給与額については${SALARY_CONTACT.desk}にご相談ください。${contactSuffix()}`,
};

/** 固定額（40万円未満）の案内。 */
export const FIXED_GUIDANCE: SalaryGuidance = {
  badge: "固定額",
  headline: `一律 ${yen(FIXED_AMOUNT)} 円が適用されます`,
  reason: `平均単価が ${yen(
    FIXED_UPPER,
  )} 円未満の場合、還元率による計算ではなく固定額 ${yen(
    FIXED_AMOUNT,
  )} 円が適用されます。`,
  nextAction: `平均単価が ${yen(
    FIXED_UPPER,
  )} 円以上になると、還元率方式での自動計算に切り替わります。`,
};

/** 要相談が絡む比較で差額を出せないときの案内。 */
export const CONSULT_DELTA_BLOCKED = `${CONSULT_GUIDANCE.badge}を含むため差額は計算できません。`;

/** status から対応する案内を引く（該当しなければ null）。 */
export function guidanceForStatus(
  status: GuidanceStatus,
): SalaryGuidance | null {
  switch (status) {
    case "consult":
      return CONSULT_GUIDANCE;
    case "fixed":
      return FIXED_GUIDANCE;
    case "ok":
      return null;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** フラットな note 文字列（API・テスト用）。consult/fixed のみ非 null。 */
export function guidanceNote(status: GuidanceStatus): string | null {
  const g = guidanceForStatus(status);
  return g ? `${g.reason} ${g.nextAction}` : null;
}

/** 要相談時の検算用計算式テキスト。 */
export function formatConsultFormula(avgUnitPrice: number): string {
  return `平均単価 ${yen(avgUnitPrice)} 円 ≧ ${yen(
    CONSULT_THRESHOLD,
  )} 円 → ${CONSULT_GUIDANCE.badge}`;
}

/** 固定額時の検算用計算式テキスト。 */
export function formatFixedFormula(avgUnitPrice: number, salary: number): string {
  return `平均単価 ${yen(avgUnitPrice)} 円 < ${yen(
    FIXED_UPPER,
  )} 円 → 一律 ${yen(salary)} 円`;
}
