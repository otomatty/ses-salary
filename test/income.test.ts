import { describe, it, expect } from "vitest";
import {
  sumAllowances,
  buildMonthlyIncome,
  calcOvertimePay,
  deemedHoursOf,
  findEmploymentType,
  DEFAULT_USER_SETTINGS,
  type MonthlyAllowanceItem,
  type UserSettings,
} from "../src/shared/income";

describe("findEmploymentType / deemedHoursOf", () => {
  it("雇用形態ごとのみなし時間を返す", () => {
    expect(findEmploymentType("fulltime_engineer").deemedOvertimeHours).toBe(20);
    expect(findEmploymentType("contract_academia").deemedOvertimeHours).toBe(14);
    expect(findEmploymentType("contract_corporate").deemedOvertimeHours).toBe(40);
    expect(findEmploymentType("other").deemedOvertimeHours).toBe(0);
  });

  it("未知のキーは『その他』にフォールバックする", () => {
    expect(findEmploymentType("xxx").key).toBe("other");
  });

  it("オーバーライドがあれば優先する", () => {
    const s: UserSettings = {
      employmentType: "fulltime_engineer",
      monthlyStandardHours: 160,
      deemedOvertimeHours: 5,
      consultRate: null,
    };
    expect(deemedHoursOf(s)).toBe(5);
    expect(deemedHoursOf({ ...s, deemedOvertimeHours: null })).toBe(20);
  });
});

describe("sumAllowances", () => {
  const items: MonthlyAllowanceItem[] = [
    { name: "役職手当", amount: 30_000, includeInOvertimeBase: false },
    { name: "職務手当", amount: 20_000, includeInOvertimeBase: true },
  ];

  it("手当を合計し、残業基礎分を分離する", () => {
    const s = sumAllowances(items);
    expect(s.total).toBe(50_000);
    expect(s.overtimeBaseTotal).toBe(20_000); // 職務手当のみ
    expect(s.items.map((i) => i.name)).toEqual(["役職手当", "職務手当"]);
  });

  it("0円以下は集計・表示から除外する", () => {
    const s = sumAllowances([
      ...items,
      { name: "廃止手当", amount: 0, includeInOvertimeBase: false },
    ]);
    expect(s.total).toBe(50_000);
    expect(s.items.some((i) => i.name === "廃止手当")).toBe(false);
  });
});

describe("calcOvertimePay（時給基礎は所定+1.25×みなしで割る）", () => {
  it("baseSalary に内包される固定残業代を二重計上しない", () => {
    // baseSalary 370,000・所定160・みなし20 → 分母 160+25=185、時給基礎=2,000。
    // 固定残業代(deemedPay)=2,000×1.25×20=50,000。
    const r = calcOvertimePay({
      baseSalary: 370_000,
      overtimeBaseAllowance: 0,
      monthlyStandardHours: 160,
      deemedHours: 20,
      normalHours: 30, // 支給対象10h
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.hourlyBase).toBeCloseTo(2_000, 5);
    expect(r.deemedPay).toBe(50_000);
    expect(r.billableNormalHours).toBe(10);
    expect(r.pay).toBe(25_000); // 2,000 × 1.25 × 10
  });

  it("みなし0なら所定で割る（従来通り）", () => {
    const r = calcOvertimePay({
      baseSalary: 320_000,
      overtimeBaseAllowance: 0,
      monthlyStandardHours: 160,
      deemedHours: 0,
      normalHours: 10,
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.hourlyBase).toBe(2_000);
    expect(r.deemedPay).toBe(0);
    expect(r.pay).toBe(25_000);
  });

  it("月60時間を超えた部分は 1.5 倍を適用する", () => {
    // 時給基礎2,000、みなし0、通常70h → 60h×1.25 + 10h×1.5
    const r = calcOvertimePay({
      baseSalary: 320_000,
      overtimeBaseAllowance: 0,
      monthlyStandardHours: 160,
      deemedHours: 0,
      normalHours: 70,
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.normalHours125).toBe(60);
    expect(r.normalHours150).toBe(10);
    expect(r.pay).toBe(150_000 + 30_000);
  });

  it("深夜は加算 0.25、法定休日は 1.35 で計算する", () => {
    const r = calcOvertimePay({
      baseSalary: 320_000,
      overtimeBaseAllowance: 0,
      monthlyStandardHours: 160,
      deemedHours: 0,
      normalHours: 0,
      nightHours: 10,
      holidayHours: 5,
    });
    expect(r.pay).toBe(5_000 + 13_500); // 2,000×0.25×10 + 2,000×1.35×5
  });

  it("残業基礎手当（職務手当）を時給基礎に算入する", () => {
    // 分母185、(370,000+20,000)/185 ≈ 2,108.1
    const r = calcOvertimePay({
      baseSalary: 370_000,
      overtimeBaseAllowance: 20_000,
      monthlyStandardHours: 160,
      deemedHours: 20,
      normalHours: 30,
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.hourlyBase).toBeCloseTo(390_000 / 185, 5);
  });
});

describe("給与明細（実データ）との一致を検証する", () => {
  // 2026-04 分（給与辞令②: G-2 / 基準単価850,000 / 還元率54.6%）。
  // salary(=単価×率)=464,126 は「基本給398,703 + 固定残業代65,423」を内包する。
  // 職務手当20,000（残業基礎に算入）。所定160h・みなし20h。実残業20.95h（20h超は0.95h）。
  const settings: UserSettings = {
    employmentType: "fulltime_engineer",
    monthlyStandardHours: 160,
    deemedOvertimeHours: null, // 20h
    consultRate: null,
  };
  const allowances: MonthlyAllowanceItem[] = [
    { name: "職務手当", amount: 20_000, includeInOvertimeBase: true },
  ];

  it("超過残業代3,108円・総支給487,234円が再現される", () => {
    const inc = buildMonthlyIncome({
      yearMonth: "2026-04",
      baseSalary: 464_126,
      settings,
      allowances,
      overtime: { normalHours: 20.95, nightHours: 0, holidayHours: 0 },
    })!;
    expect(inc).not.toBeNull();
    // 時給基礎 = 484,126 / 185 ≈ 2,616.9（明細の (398,703+20,000)/160 と一致）
    expect(inc.overtime.hourlyBase).toBeCloseTo(2_616.9, 1);
    // 固定残業代は明細の65,423 とほぼ一致（会社側の端数処理で±1円）
    expect(Math.abs(inc.overtime.deemedPay - 65_423)).toBeLessThanOrEqual(1);
    // 超過残業代 = 0.95h 分 = 3,108 円（明細一致）
    expect(inc.overtimePay).toBe(3_108);
    expect(inc.allowanceTotal).toBe(20_000);
    // 総支給 = 464,126 + 20,000 + 3,108 = 487,234（明細一致）
    expect(inc.gross).toBe(487_234);
  });
});

describe("buildMonthlyIncome", () => {
  const settings: UserSettings = {
    employmentType: "fulltime_engineer",
    monthlyStandardHours: 160,
    deemedOvertimeHours: null,
    consultRate: null,
  };

  it("残業未入力なら残業代0、手当のみ加算", () => {
    const r = buildMonthlyIncome({
      yearMonth: "2026-03",
      baseSalary: 400_000,
      settings,
      allowances: [
        { name: "役職手当", amount: 30_000, includeInOvertimeBase: false },
      ],
      overtime: null,
    })!;
    expect(r.overtimePay).toBe(0);
    expect(r.gross).toBe(430_000);
  });

  it("基本給が null（要相談など）なら null を返す", () => {
    const r = buildMonthlyIncome({
      yearMonth: "2026-03",
      baseSalary: null,
      settings,
      allowances: [],
      overtime: { normalHours: 30, nightHours: 0, holidayHours: 0 },
    });
    expect(r).toBeNull();
  });

  it("既定設定はみなし20h・所定160h", () => {
    expect(DEFAULT_USER_SETTINGS.monthlyStandardHours).toBe(160);
    expect(deemedHoursOf(DEFAULT_USER_SETTINGS)).toBe(20);
  });
});
