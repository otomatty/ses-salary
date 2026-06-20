import { describe, it, expect } from "vitest";
import {
  applyAllowanceTemplate,
  allowancesEqual,
  buildAllowanceDraftFromDashboard,
  emptyMasterRows,
  masterRowsToItems,
  type AllowanceDraft,
} from "../src/client/lib/allowanceStrip";
import { monthHasPayableSalary } from "../src/shared/quarterSalary";

describe("monthHasPayableSalary", () => {
  it("直前四半期の単価が揃えば当月は支給額あり", () => {
    const priceMap = new Map([
      ["2025-10", 800_000],
      ["2025-11", 800_000],
      ["2025-12", 800_000],
    ]);
    const rankDraft = new Map<string, 1 | 2 | 3>();
    expect(monthHasPayableSalary("2026-01", priceMap, rankDraft)).toBe(true);
    expect(monthHasPayableSalary("2025-10", priceMap, rankDraft)).toBe(false);
  });

  it("当月に単価がなくても直前四半期が揃えば支給額あり", () => {
    const priceMap = new Map([
      ["2025-07", 700_000],
      ["2025-08", 700_000],
      ["2025-09", 700_000],
    ]);
    expect(
      monthHasPayableSalary("2025-10", priceMap, new Map()),
    ).toBe(true);
    expect(priceMap.has("2025-10")).toBe(false);
  });
});

describe("masterRowsToItems", () => {
  it("マスタから includeInOvertimeBase を設定する", () => {
    const rows = emptyMasterRows().map((r) =>
      r.name === "職務手当"
        ? { ...r, enabled: true, amountManYen: 2 }
        : r.name === "通勤手当"
          ? { ...r, enabled: true, amountManYen: 0.833 }
          : r,
    );
    const items = masterRowsToItems(rows);
    expect(items).toEqual([
      { name: "職務手当", amount: 20_000, includeInOvertimeBase: true },
      { name: "通勤手当", amount: 8330, includeInOvertimeBase: false },
    ]);
  });

  it("未選択・未入力の行は除外する", () => {
    expect(masterRowsToItems(emptyMasterRows())).toEqual([]);
  });
});

describe("buildAllowanceDraftFromDashboard", () => {
  it("マスタ登録名は includeInOvertimeBase をマスタから復元する", () => {
    const draft = buildAllowanceDraftFromDashboard([
      {
        id: "1",
        yearMonth: "2026-01",
        name: "職務手当",
        amount: 20_000,
        includeInOvertimeBase: false,
      },
    ]);
    expect(draft.get("2026-01")).toEqual([
      { name: "職務手当", amount: 20_000, includeInOvertimeBase: true },
    ]);
  });
});

describe("applyAllowanceTemplate", () => {
  it("選択月に同じ手当を一括コピーする", () => {
    const draft: AllowanceDraft = new Map();
    draft.set("2026-01", [{ name: "旧", amount: 1000, includeInOvertimeBase: false }]);
    const next = applyAllowanceTemplate(
      draft,
      ["2026-02", "2026-03"],
      [{ name: "職務手当", amount: 20_000, includeInOvertimeBase: true }],
    );
    expect(next.get("2026-01")).toEqual([
      { name: "旧", amount: 1000, includeInOvertimeBase: false },
    ]);
    expect(next.get("2026-02")).toEqual([
      { name: "職務手当", amount: 20_000, includeInOvertimeBase: true },
    ]);
    expect(next.get("2026-03")).toEqual([
      { name: "職務手当", amount: 20_000, includeInOvertimeBase: true },
    ]);
  });

  it("allowancesEqual は名前順に正規化して比較する", () => {
    const a = [
      { name: "B", amount: 1, includeInOvertimeBase: false },
      { name: "A", amount: 2, includeInOvertimeBase: true },
    ];
    const b = [
      { name: "A", amount: 2, includeInOvertimeBase: true },
      { name: "B", amount: 1, includeInOvertimeBase: false },
    ];
    expect(allowancesEqual(a, b)).toBe(true);
  });
});
