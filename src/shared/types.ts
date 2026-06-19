/** クライアント・サーバ間で共有する API の型定義 */

import type { Rank } from "./rateTable";
import type { SalaryResult } from "./periods";
import type { SalaryStatus } from "./calc";
import type { EmploymentTypeKey, MonthlyIncomeBreakdown } from "./income";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
}

export interface MonthlyPriceDTO {
  id: string;
  yearMonth: string; // "YYYY-MM"
  unitPrice: number;
}

export interface RankHistoryDTO {
  id: string;
  effectiveFrom: string; // "YYYY-MM"
  rank: Rank;
}

/** 月ごとの手当エントリ（年月 × 手当名ごと）。 */
export interface AllowanceDTO {
  id: string;
  yearMonth: string; // "YYYY-MM"
  name: string;
  amount: number; // 円
  includeInOvertimeBase: boolean;
}

/** 月次の残業時間（区分別）。 */
export interface MonthlyOvertimeDTO {
  id: string;
  yearMonth: string; // "YYYY-MM"
  normalHours: number;
  nightHours: number;
  holidayHours: number;
}

/** 雇用形態・所定労働時間などの本人設定。 */
export interface UserSettingsDTO {
  employmentType: EmploymentTypeKey;
  monthlyStandardHours: number;
  /** みなし残業時間のオーバーライド（null なら雇用形態から導出） */
  deemedOvertimeHours: number | null;
  /** M帯(要相談 / 140万円以上)の手動還元率(%)。null なら従来どおり要相談（自動計算外） */
  consultRate: number | null;
}

/** 月の額面実支給見込み（基本給 + 手当 + 残業）の内訳。 */
export type MonthlyIncomeDTO = MonthlyIncomeBreakdown;

/**
 * 永続化された給与計算結果スナップショット（PRD §9 / salary_results）。
 * 確定時点の率・額をそのまま保持する監査用レコード。
 */
export interface SalaryResultDTO {
  id: string;
  appliedFrom: string; // "YYYY-MM"
  avgUnitPrice: number;
  appliedBand: string;
  appliedRank: Rank;
  appliedRate: number | null;
  salary: number | null;
  status: SalaryStatus;
  /** 計算（保存）日時 unix ms */
  calculatedAt: number;
}

/** GET /api/me */
export interface MeResponse {
  user: ApiUser | null;
}

/** GET /api/dashboard */
export interface DashboardResponse {
  prices: MonthlyPriceDTO[];
  rankHistory: RankHistoryDTO[];
  currentRank: Rank;
  /**
   * 現在の評価ランクが暫定（未設定による fallback）か。
   * true のとき、ダッシュボード等で「暫定ランクで計算中」である旨を明示する（PRD §12.3）。
   */
  rankProvisional: boolean;
  /** 今期（現在適用中）の給与。算出不能なら null */
  current: SalaryResult | null;
  /** 来期（次に適用される）の給与。算出不能なら null */
  next: SalaryResult | null;
  /** 過去〜来期の給与推移（古い順） */
  history: SalaryResult[];
  /** 確定保存済みスナップショット（古い順）。再計算値と区別表示するために併記する */
  savedResults: SalaryResultDTO[];
  /** 来期計算に必要な月単価が不足している場合のメッセージ */
  nextPending: string | null;
  /** 登録済みの特別手当（適用開始月の昇順） */
  allowances: AllowanceDTO[];
  /** 登録済みの月次残業時間（年月の昇順） */
  overtime: MonthlyOvertimeDTO[];
  /** 雇用形態・所定労働時間などの本人設定（未設定なら既定値） */
  settings: UserSettingsDTO;
  /** 当月（currentYearMonth）の月収内訳。基本給が算出不能なら null */
  currentMonthIncome: MonthlyIncomeDTO | null;
}

export interface ApiError {
  error: string;
}
