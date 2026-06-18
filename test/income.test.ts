import { describe, it, expect } from "vitest";
import {
  activeAllowances,
  buildMonthlyIncome,
  calcOvertimePay,
  deemedHoursOf,
  findEmploymentType,
  DEFAULT_USER_SETTINGS,
  type AllowanceEntry,
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
    };
    expect(deemedHoursOf(s)).toBe(5);
    expect(
      deemedHoursOf({ ...s, deemedOvertimeHours: null }),
    ).toBe(20);
  });
});

describe("activeAllowances", () => {
  const history: AllowanceEntry[] = [
    { name: "役職手当", effectiveFrom: "2026-01", amount: 30_000, includeInOvertimeBase: false },
    { name: "職務手当", effectiveFrom: "2026-01", amount: 20_000, includeInOvertimeBase: true },
    // 役職手当は 2026-04 から増額
    { name: "役職手当", effectiveFrom: "2026-04", amount: 50_000, includeInOvertimeBase: false },
  ];

  it("対象月時点で各手当名の最新を採用して合計する", () => {
    const mar = activeAllowances(history, "2026-03");
    expect(mar.total).toBe(50_000); // 役職3万 + 職務2万
    expect(mar.overtimeBaseTotal).toBe(20_000); // 職務のみ残業基礎
    expect(mar.items.map((i) => i.name)).toEqual(["役職手当", "職務手当"]);

    const apr = activeAllowances(history, "2026-04");
    expect(apr.total).toBe(70_000); // 役職5万（増額後） + 職務2万
  });

  it("適用開始月より前の月には適用しない", () => {
    const before = activeAllowances(history, "2025-12");
    expect(before.total).toBe(0);
    expect(before.items).toEqual([]);
  });

  it("amount 0 は廃止として除外する", () => {
    const withStop: AllowanceEntry[] = [
      ...history,
      { name: "役職手当", effectiveFrom: "2026-07", amount: 0, includeInOvertimeBase: false },
    ];
    const jul = activeAllowances(withStop, "2026-07");
    expect(jul.items.some((i) => i.name === "役職手当")).toBe(false);
    expect(jul.total).toBe(20_000); // 職務手当のみ残る
  });
});

describe("calcOvertimePay", () => {
  // 時給基礎 = (300,000 + 0) / 150 = 2,000 円/時
  const base = {
    baseSalary: 300_000,
    overtimeBaseAllowance: 0,
    monthlyStandardHours: 150,
  };

  it("みなし超過分のみ 1.25 倍で支給する", () => {
    // 通常30h・みなし20h → 支給対象10h × 2000 × 1.25 = 25,000
    const r = calcOvertimePay({
      ...base,
      deemedHours: 20,
      normalHours: 30,
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.hourlyBase).toBe(2_000);
    expect(r.billableNormalHours).toBe(10);
    expect(r.normalHours125).toBe(10);
    expect(r.normalHours150).toBe(0);
    expect(r.pay).toBe(25_000);
  });

  it("みなし時間以下なら残業代は0", () => {
    const r = calcOvertimePay({
      ...base,
      deemedHours: 20,
      normalHours: 15,
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.billableNormalHours).toBe(0);
    expect(r.pay).toBe(0);
  });

  it("月60時間を超えた部分は 1.5 倍を適用する", () => {
    // 通常70h・みなし0h → 60hまで1.25、超過10hは1.5
    // 2000×1.25×60 + 2000×1.5×10 = 150,000 + 30,000 = 180,000
    const r = calcOvertimePay({
      ...base,
      deemedHours: 0,
      normalHours: 70,
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.normalHours125).toBe(60);
    expect(r.normalHours150).toBe(10);
    expect(r.pay).toBe(180_000);
  });

  it("深夜は加算 0.25、法定休日は 1.35 で計算する", () => {
    // 深夜10h × 2000 × 0.25 = 5,000、休日5h × 2000 × 1.35 = 13,500
    const r = calcOvertimePay({
      ...base,
      deemedHours: 0,
      normalHours: 0,
      nightHours: 10,
      holidayHours: 5,
    });
    expect(r.pay).toBe(5_000 + 13_500);
  });

  it("残業基礎手当（職務手当）を時給基礎に算入する", () => {
    // 時給基礎 = (300,000 + 30,000) / 150 = 2,200。支給10h × 1.25 = 27,500
    const r = calcOvertimePay({
      baseSalary: 300_000,
      overtimeBaseAllowance: 30_000,
      monthlyStandardHours: 150,
      deemedHours: 20,
      normalHours: 30,
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.hourlyBase).toBe(2_200);
    expect(r.pay).toBe(27_500);
  });
});

describe("buildMonthlyIncome", () => {
  const settings: UserSettings = {
    employmentType: "fulltime_engineer", // みなし20h
    monthlyStandardHours: 150,
    deemedOvertimeHours: null,
  };
  const allowanceHistory: AllowanceEntry[] = [
    { name: "役職手当", effectiveFrom: "2026-01", amount: 30_000, includeInOvertimeBase: false },
  ];

  it("基本給 + 手当 + 残業代を合算する", () => {
    // 時給基礎 = 300,000/150 = 2,000。支給10h×1.25 = 25,000。手当30,000。
    const r = buildMonthlyIncome({
      yearMonth: "2026-03",
      baseSalary: 300_000,
      settings,
      allowanceHistory,
      overtime: { normalHours: 30, nightHours: 0, holidayHours: 0 },
    });
    expect(r).not.toBeNull();
    expect(r!.allowanceTotal).toBe(30_000);
    expect(r!.overtimePay).toBe(25_000);
    expect(r!.gross).toBe(355_000);
  });

  it("残業未入力なら残業代0、手当のみ加算", () => {
    const r = buildMonthlyIncome({
      yearMonth: "2026-03",
      baseSalary: 300_000,
      settings,
      allowanceHistory,
      overtime: null,
    });
    expect(r!.overtimePay).toBe(0);
    expect(r!.gross).toBe(330_000);
  });

  it("基本給が null（要相談など）なら null を返す", () => {
    const r = buildMonthlyIncome({
      yearMonth: "2026-03",
      baseSalary: null,
      settings,
      allowanceHistory,
      overtime: { normalHours: 30, nightHours: 0, holidayHours: 0 },
    });
    expect(r).toBeNull();
  });

  it("既定設定はみなし20h・所定160h", () => {
    expect(DEFAULT_USER_SETTINGS.monthlyStandardHours).toBe(160);
    expect(deemedHoursOf(DEFAULT_USER_SETTINGS)).toBe(20);
  });
});
