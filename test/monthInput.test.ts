import { describe, it, expect } from "vitest";
import { resolveMonthUpsert } from "../src/worker/routes/monthInput";

describe("resolveMonthUpsert", () => {
  const existing = {
    id: "e1",
    userId: "u1",
    yearMonth: "2026-01",
    unitPrice: 850_000,
    overtimeNormalHours: 5,
    overtimeNightHours: 1,
    overtimeHolidayHours: 0,
    updatedAt: 0,
  };

  it("部分更新: 残業のみ送ると単価・手当は維持", () => {
    const r = resolveMonthUpsert(
      { overtime: { normalHours: 25, nightHours: 0, holidayHours: 0 } },
      existing,
    );
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.unitPrice).toBe(850_000);
    expect(r.overtime).toEqual({
      normalHours: 25,
      nightHours: 0,
      holidayHours: 0,
    });
    expect(r.replaceAllowances).toBe(false);
  });

  it("手当更新時はマスタから includeInOvertimeBase を設定", () => {
    const r = resolveMonthUpsert(
      {
        allowances: [
          { name: "職務手当", amount: 20_000, includeInOvertimeBase: false },
        ],
      },
      existing,
    );
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.replaceAllowances).toBe(true);
    expect(r.allowances[0]).toEqual({
      name: "職務手当",
      amount: 20_000,
      includeInOvertimeBase: true,
    });
  });

  it("未登録手当名はエラー", () => {
    const r = resolveMonthUpsert(
      { allowances: [{ name: "未知", amount: 1000 }] },
      undefined,
    );
    expect(r).toEqual({ error: "未登録の手当名です（未知）。" });
  });

  it("非オブジェクト JSON はエラー", () => {
    expect(resolveMonthUpsert([], existing)).toEqual({
      error: "リクエスト形式が不正です。",
    });
    expect(resolveMonthUpsert("x", existing)).toEqual({
      error: "リクエスト形式が不正です。",
    });
  });
});
