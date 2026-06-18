/**
 * 月収（額面実支給見込み）の算出ロジック。
 *
 * 本アプリの中核（calc.ts）は、四半期の平均単価 × 還元率で「基本給」を算出する。
 * 実際の月収はこれに **特別手当** と **残業代** を加えたものになるため、
 * このモジュールでその加算分を計算する。
 *
 * 残業代は会社規程（株式会社アーシャルデザイン）に基づく:
 *   残業単価 = (基本給 + 職務手当) ÷ 月平均所定労働時間 × 割増率
 * かつ、みなし残業（固定時間外手当）として基本給に含まれる時間分は二重計上せず、
 * **みなし時間を超えた分のみ** を別途支給する。
 *
 * calc.ts と同じく「計算過程（時給基礎・各区分の時間と金額）」を内訳として返し、
 * 透明性（検算可能性）を保つ。
 */

/** 月平均所定労働時間の既定値（規程の 1ヶ月平均所定労働時間。設定で変更可能）。 */
export const DEFAULT_MONTHLY_STANDARD_HOURS = 160;

/** この時間を超えた時間外労働は割増率が上がる（月60時間超 = 1.5倍）。 */
export const OVERTIME_60H_THRESHOLD = 60;

/** 割増率（規程 §2）。深夜は加算分のみ（0.25）。 */
export const OVERTIME_MULTIPLIERS = {
  /** 時間外労働（月60時間以下）: 25％増 */
  normal: 1.25,
  /** 時間外労働（月60時間超）: 50％増 */
  over60: 1.5,
  /** 深夜労働（22:00〜5:00）: 25％増（加算分のみ） */
  night: 0.25,
  /** 法定休日労働: 35％増 */
  holiday: 1.35,
} as const;

export type EmploymentTypeKey =
  | "fulltime_engineer"
  | "contract_academia"
  | "contract_corporate"
  | "other";

export interface EmploymentType {
  key: EmploymentTypeKey;
  label: string;
  /** みなし残業（固定時間外手当）に含まれる時間。この時間までは基本給に含まれる。 */
  deemedOvertimeHours: number;
}

/** 雇用形態とみなし残業時間（規程 §2③）。 */
export const EMPLOYMENT_TYPES: EmploymentType[] = [
  {
    key: "fulltime_engineer",
    label: "正社員（エンジニア）",
    deemedOvertimeHours: 20,
  },
  {
    key: "contract_academia",
    label: "契約社員（アカデミア生）",
    deemedOvertimeHours: 14,
  },
  {
    key: "contract_corporate",
    label: "契約社員（コーポレート）",
    deemedOvertimeHours: 40,
  },
  // 管理監督者・固定時間外手当なしの区分。みなし0時間（=1時間目から支給対象）。
  { key: "other", label: "その他 / 管理監督者", deemedOvertimeHours: 0 },
];

export const DEFAULT_EMPLOYMENT_TYPE: EmploymentTypeKey = "fulltime_engineer";

/** 雇用形態キーから定義を引く。未知のキーは末尾（その他）にフォールバック。 */
export function findEmploymentType(key: string): EmploymentType {
  return (
    EMPLOYMENT_TYPES.find((t) => t.key === key) ??
    EMPLOYMENT_TYPES[EMPLOYMENT_TYPES.length - 1]
  );
}

export function isEmploymentTypeKey(v: unknown): v is EmploymentTypeKey {
  return typeof v === "string" && EMPLOYMENT_TYPES.some((t) => t.key === v);
}

export interface UserSettings {
  employmentType: EmploymentTypeKey;
  /** 1ヶ月平均所定労働時間（残業単価の分母）。 */
  monthlyStandardHours: number;
  /** 雇用形態から導かれるみなし時間を上書きする値。null なら雇用形態に従う。 */
  deemedOvertimeHours: number | null;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  employmentType: DEFAULT_EMPLOYMENT_TYPE,
  monthlyStandardHours: DEFAULT_MONTHLY_STANDARD_HOURS,
  deemedOvertimeHours: null,
};

/** 実際に適用するみなし残業時間（オーバーライド優先、無ければ雇用形態から）。 */
export function deemedHoursOf(settings: UserSettings): number {
  if (settings.deemedOvertimeHours != null) {
    return Math.max(0, settings.deemedOvertimeHours);
  }
  return findEmploymentType(settings.employmentType).deemedOvertimeHours;
}

/** 手当の履歴エントリ（適用開始月ごと。amount 0 で廃止を表す）。 */
export interface AllowanceEntry {
  name: string;
  /** "YYYY-MM" */
  effectiveFrom: string;
  /** 円。0 は「その月以降は廃止」を表す。 */
  amount: number;
  /** 残業単価の基礎（基本給 + 職務手当）に算入するか。 */
  includeInOvertimeBase: boolean;
}

export interface ActiveAllowance {
  name: string;
  amount: number;
  includeInOvertimeBase: boolean;
}

export interface ActiveAllowances {
  items: ActiveAllowance[];
  /** 当月の手当合計（円） */
  total: number;
  /** 残業基礎に算入する手当の合計（職務手当など, 円） */
  overtimeBaseTotal: number;
}

/**
 * 指定の年月時点で有効な手当を、手当名ごとに「適用開始月が対象月以前で最新のもの」を
 * 採用して集計する（rankAt と同じ『最新が有効』ロジックを手当名単位で適用）。
 * amount 0 は廃止として除外する。
 */
export function activeAllowances(
  history: AllowanceEntry[],
  ym: string,
): ActiveAllowances {
  const latestByName = new Map<string, AllowanceEntry>();
  for (const e of history) {
    if (e.effectiveFrom > ym) continue; // 未来の改定は対象外
    const cur = latestByName.get(e.name);
    if (!cur || e.effectiveFrom > cur.effectiveFrom) {
      latestByName.set(e.name, e);
    }
  }

  const items: ActiveAllowance[] = [];
  let total = 0;
  let overtimeBaseTotal = 0;
  for (const e of latestByName.values()) {
    if (e.amount <= 0) continue; // 廃止
    items.push({
      name: e.name,
      amount: e.amount,
      includeInOvertimeBase: e.includeInOvertimeBase,
    });
    total += e.amount;
    if (e.includeInOvertimeBase) overtimeBaseTotal += e.amount;
  }
  items.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { items, total, overtimeBaseTotal };
}

/** 月次の残業時間（区分別）。 */
export interface OvertimeHours {
  /** 通常の時間外労働（時間） */
  normalHours: number;
  /** 深夜労働（時間, 22:00〜5:00。加算0.25のみ） */
  nightHours: number;
  /** 法定休日労働（時間） */
  holidayHours: number;
}

export interface OvertimeBreakdown {
  /** 時給基礎（円/時, 四捨五入前の実数） */
  hourlyBase: number;
  /** みなし残業時間（この値までは基本給に含まれる） */
  deemedHours: number;
  /** 支給対象の通常残業時間（みなし超過分） */
  billableNormalHours: number;
  /** 1.25倍を適用する時間 */
  normalHours125: number;
  /** 1.5倍を適用する時間（月60時間超の部分） */
  normalHours150: number;
  nightHours: number;
  holidayHours: number;
  /** 残業代（円, 四捨五入後） */
  pay: number;
}

export interface OvertimePayParams {
  baseSalary: number;
  /** 残業基礎に算入する手当の合計（職務手当など） */
  overtimeBaseAllowance: number;
  monthlyStandardHours: number;
  deemedHours: number;
  normalHours: number;
  nightHours: number;
  holidayHours: number;
}

/**
 * 残業代を算出する。
 * 時給基礎 = (基本給 + 残業基礎手当) ÷ 月平均所定労働時間。
 * 通常時間外はみなし超過分のみ支給し、月60時間を超える部分は 1.5 倍を適用する。
 */
export function calcOvertimePay(p: OvertimePayParams): OvertimeBreakdown {
  const monthlyStandardHours =
    p.monthlyStandardHours > 0
      ? p.monthlyStandardHours
      : DEFAULT_MONTHLY_STANDARD_HOURS;
  const hourlyBase = (p.baseSalary + p.overtimeBaseAllowance) / monthlyStandardHours;

  const normalHours = Math.max(0, p.normalHours);
  const deemedHours = Math.max(0, p.deemedHours);
  // みなし時間を超えた分のみ支給対象（基本給に含まれるみなし分を二重計上しない）。
  const billableNormalHours = Math.max(0, normalHours - deemedHours);
  // 月60時間を超えた部分は 1.5 倍。支給対象（みなし超過）の範囲内でのみ計上する。
  const over60 = Math.max(0, normalHours - OVERTIME_60H_THRESHOLD);
  const normalHours150 = Math.min(over60, billableNormalHours);
  const normalHours125 = billableNormalHours - normalHours150;

  const nightHours = Math.max(0, p.nightHours);
  const holidayHours = Math.max(0, p.holidayHours);

  const pay = Math.round(
    hourlyBase *
      (OVERTIME_MULTIPLIERS.normal * normalHours125 +
        OVERTIME_MULTIPLIERS.over60 * normalHours150 +
        OVERTIME_MULTIPLIERS.night * nightHours +
        OVERTIME_MULTIPLIERS.holiday * holidayHours),
  );

  return {
    hourlyBase,
    deemedHours,
    billableNormalHours,
    normalHours125,
    normalHours150,
    nightHours,
    holidayHours,
    pay,
  };
}

export interface MonthlyIncomeBreakdown {
  /** "YYYY-MM" */
  yearMonth: string;
  /** 基本給（その月が属する四半期の確定給与, 円） */
  baseSalary: number;
  /** 当月の手当合計（円） */
  allowanceTotal: number;
  /** 当月の残業代（円） */
  overtimePay: number;
  /** 月の額面実支給見込み = 基本給 + 手当 + 残業代（円） */
  gross: number;
  /** 当月有効な手当の明細 */
  allowances: ActiveAllowance[];
  /** 残業代の内訳 */
  overtime: OvertimeBreakdown;
}

/**
 * 基本給・手当・残業の生データから、月の額面実支給見込みを組み立てる。
 * baseSalary が null（要相談など算出不能）の場合は null を返す。
 */
export function buildMonthlyIncome(params: {
  yearMonth: string;
  baseSalary: number | null;
  settings: UserSettings;
  allowanceHistory: AllowanceEntry[];
  overtime: OvertimeHours | null;
}): MonthlyIncomeBreakdown | null {
  const { yearMonth, baseSalary, settings, allowanceHistory, overtime } = params;
  if (baseSalary === null) return null;

  const allowances = activeAllowances(allowanceHistory, yearMonth);
  const ot = calcOvertimePay({
    baseSalary,
    overtimeBaseAllowance: allowances.overtimeBaseTotal,
    monthlyStandardHours: settings.monthlyStandardHours,
    deemedHours: deemedHoursOf(settings),
    normalHours: overtime?.normalHours ?? 0,
    nightHours: overtime?.nightHours ?? 0,
    holidayHours: overtime?.holidayHours ?? 0,
  });

  return {
    yearMonth,
    baseSalary,
    allowanceTotal: allowances.total,
    overtimePay: ot.pay,
    gross: baseSalary + allowances.total + ot.pay,
    allowances: allowances.items,
    overtime: ot,
  };
}
