import { describe, it, expect } from "vitest";
import {
  applyAllowanceTemplate,
  allowancesEqual,
  availableAllowanceCandidates,
  buildAllowanceDraftFromDashboard,
  emptyMasterRows,
  makeAllowanceRow,
  masterRowsFromDtos,
  masterRowsToItems,
  validateMasterRows,
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

describe("emptyMasterRows", () => {
  it("初期状態は手当0件", () => {
    expect(emptyMasterRows()).toEqual([]);
  });
});

describe("makeAllowanceRow", () => {
  it("マスタ手当は既定額・残業基礎を引き継ぐ", () => {
    expect(makeAllowanceRow("TL手当")).toEqual({
      name: "TL手当",
      enabled: true,
      amountManYen: 2,
      includeInOvertimeBase: true,
    });
  });

  it("任意名称は金額未入力・残業基礎OFFが初期値", () => {
    expect(makeAllowanceRow("出張手当")).toEqual({
      name: "出張手当",
      enabled: true,
      amountManYen: null,
      includeInOvertimeBase: false,
    });
  });
});

describe("availableAllowanceCandidates", () => {
  it("追加済みのマスタ手当は候補から除外する", () => {
    const names = availableAllowanceCandidates([makeAllowanceRow("TL手当")]).map(
      (d) => d.name,
    );
    expect(names).not.toContain("TL手当");
    expect(names).toContain("役職手当");
  });
});

describe("validateMasterRows", () => {
  it("手当名の重複を弾く", () => {
    const rows = [
      { name: "出張手当", enabled: true, amountManYen: 1, includeInOvertimeBase: false },
      { name: "出張手当", enabled: true, amountManYen: 2, includeInOvertimeBase: false },
    ];
    expect(validateMasterRows(rows)).toMatch(/重複/);
  });

  it("正しい行は null", () => {
    expect(validateMasterRows([makeAllowanceRow("TL手当")])).toBeNull();
  });
});

describe("masterRowsToItems", () => {
  it("マスタから includeInOvertimeBase を設定する", () => {
    const rows = [
      { ...makeAllowanceRow("TL手当"), amountManYen: 2 },
      { ...makeAllowanceRow("通勤手当"), amountManYen: 0.833 },
    ];
    const items = masterRowsToItems(rows);
    expect(items).toEqual([
      { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
      { name: "通勤手当", amount: 8330, includeInOvertimeBase: false },
    ]);
  });

  it("任意手当はトグルした残業基礎フラグを保存する", () => {
    const rows = [
      { ...makeAllowanceRow("出張手当"), amountManYen: 1, includeInOvertimeBase: true },
    ];
    expect(masterRowsToItems(rows)).toEqual([
      { name: "出張手当", amount: 10_000, includeInOvertimeBase: true },
    ]);
  });

  it("未入力の行は除外する", () => {
    expect(masterRowsToItems([makeAllowanceRow("役職手当")])).toEqual([]);
  });
});

describe("masterRowsFromDtos", () => {
  it("マスタ外の旧データ手当を保持する", () => {
    const rows = masterRowsFromDtos([
      {
        id: "1",
        yearMonth: "2026-01",
        name: "カスタム手当",
        amount: 5_000,
        includeInOvertimeBase: true,
      },
    ]);
    const custom = rows.find((r) => r.name === "カスタム手当");
    expect(custom).toEqual({
      name: "カスタム手当",
      enabled: true,
      amountManYen: 0.5,
      includeInOvertimeBase: true,
    });
    expect(masterRowsToItems(rows)).toEqual([
      {
        name: "カスタム手当",
        amount: 5_000,
        includeInOvertimeBase: true,
      },
    ]);
  });
});

describe("buildAllowanceDraftFromDashboard", () => {
  it("マスタ登録名は includeInOvertimeBase をマスタから復元する", () => {
    const draft = buildAllowanceDraftFromDashboard([
      {
        id: "1",
        yearMonth: "2026-01",
        name: "TL手当",
        amount: 20_000,
        includeInOvertimeBase: false,
      },
    ]);
    expect(draft.get("2026-01")).toEqual([
      { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
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
      [{ name: "TL手当", amount: 20_000, includeInOvertimeBase: true }],
    );
    expect(next.get("2026-01")).toEqual([
      { name: "旧", amount: 1000, includeInOvertimeBase: false },
    ]);
    expect(next.get("2026-02")).toEqual([
      { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
    ]);
    expect(next.get("2026-03")).toEqual([
      { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
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
