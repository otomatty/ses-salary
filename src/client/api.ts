/** API クライアント（fetch ラッパ）。Cookie セッションを使うため credentials: same-origin。 */

import type {
  DashboardResponse,
  MeResponse,
  MonthlyPriceDTO,
  SalaryResultDTO,
  UserSettingsDTO,
} from "@shared/types";
import type { Rank } from "@shared/rateTable";
import type { EmploymentTypeKey } from "@shared/income";

/** 月別保存（単価・残業・手当）。各フィールドは省略可能（省略時は既存値を維持、新規行は 0）。 */
export interface MonthInput {
  unitPrice?: number;
  overtime?: {
    normalHours: number;
    nightHours: number;
    holidayHours: number;
  };
  /** 手当名はマスタ登録名のみ。includeInOvertimeBase はサーバがマスタから決定する。 */
  allowances?: { name: string; amount: number }[];
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `リクエストに失敗しました (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  me: () => request<MeResponse>("/api/me"),
  dashboard: () => request<DashboardResponse>("/api/dashboard"),

  salaryResults: () =>
    request<{ results: SalaryResultDTO[] }>("/api/salary-results"),

  savePrice: (yearMonth: string, unitPrice: number) =>
    request<{ price: MonthlyPriceDTO }>("/api/prices", {
      method: "POST",
      body: JSON.stringify({ yearMonth, unitPrice }),
    }),

  /** 複数月の単価をまとめて作成/更新する（連続月の一括入力用）。 */
  savePricesBulk: (items: { yearMonth: string; unitPrice: number }[]) =>
    request<{ prices: MonthlyPriceDTO[] }>("/api/prices/bulk", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  /** その月の単価・残業・手当をまとめて保存（upsert）する。 */
  saveMonth: (yearMonth: string, input: MonthInput) =>
    request<{ ok: true }>(`/api/months/${yearMonth}`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** その月の入力（単価・残業・手当）をすべて削除する。 */
  deleteMonth: (yearMonth: string) =>
    request<{ ok: true }>(`/api/months/${yearMonth}`, { method: "DELETE" }),

  saveRank: (rank: Rank, effectiveFrom?: string) =>
    request<{ rank: { id: string; effectiveFrom: string; rank: Rank } }>(
      "/api/rank",
      {
        method: "POST",
        body: JSON.stringify({ rank, effectiveFrom }),
      },
    ),

  deleteRank: (id: string) =>
    request<{ ok: true }>(`/api/rank/${id}`, { method: "DELETE" }),

  saveSettings: (input: {
    employmentType: EmploymentTypeKey;
    monthlyStandardHours: number;
    deemedOvertimeHours: number | null;
    consultRate: number | null;
  }) =>
    request<{ settings: UserSettingsDTO }>("/api/settings", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteAllData: () =>
    request<{ ok: true }>("/api/user/data", { method: "DELETE" }),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  devLogin: () =>
    request<{ ok: true }>("/auth/dev-login", { method: "POST" }),
};
