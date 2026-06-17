/** クライアント・サーバ間で共有する API の型定義 */

import type { Rank } from "./rateTable";
import type { SalaryResult } from "./periods";

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

/** GET /api/me */
export interface MeResponse {
  user: ApiUser | null;
}

/** GET /api/dashboard */
export interface DashboardResponse {
  prices: MonthlyPriceDTO[];
  rankHistory: RankHistoryDTO[];
  currentRank: Rank;
  /** 今期（現在適用中）の給与。算出不能なら null */
  current: SalaryResult | null;
  /** 来期（次に適用される）の給与。算出不能なら null */
  next: SalaryResult | null;
  /** 過去〜来期の給与推移（古い順） */
  history: SalaryResult[];
  /** 来期計算に必要な月単価が不足している場合のメッセージ */
  nextPending: string | null;
}

export interface ApiError {
  error: string;
}
