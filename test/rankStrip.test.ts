import { describe, expect, it } from "vitest";
import { formatManYenFloorDisplay } from "../src/shared/calc";
import {
  applyRankDraft,
  clearRankDraft,
  DEFAULT_PICKER_RANK,
  normalizeRankDraft,
  pickerRankForSelection,
  rankBadgeForCell,
  rankBadgeLabel,
  rankForQuarter,
  selectionKey,
} from "../src/client/lib/rankStrip";
import {
  formatSelectionQuartersLabel,
  quarterSelectionRange,
  selectedQuarterStarts,
} from "../src/client/lib/quarterStrip";
import { monthSelectionRange } from "../src/client/lib/yearMonthStrip";
import { salaryCellLabelForDraft } from "../src/shared/quarterSalary";

describe("formatManYenFloorDisplay", () => {
  it("万円未満の端数を切り捨てる", () => {
    expect(formatManYenFloorDisplay(452_455)).toBe("45万円");
    expect(formatManYenFloorDisplay(464_100)).toBe("46万円");
  });
});

describe("quarterSelectionRange", () => {
  it("1ヶ月クリックで四半期3ヶ月すべて選択", () => {
    const sel = quarterSelectionRange("2026-02", "2026-02");
    expect([...sel].sort()).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
});

describe("applyRankDraft", () => {
  it("選択四半期の開始月キーにランクを保存", () => {
    const draft = new Map([["2026-04", 1 as const]]);
    const next = applyRankDraft(draft, ["2026-02", "2026-03"], 3);
    expect(next.get("2026-01")).toBe(3);
    expect(next.get("2026-04")).toBe(1);
  });
});

describe("clearRankDraft", () => {
  it("選択四半期の明示設定だけ削除", () => {
    const draft = new Map<string, 1 | 2 | 3>([
      ["2026-01", 1],
      ["2026-04", 2],
    ]);
    const next = clearRankDraft(draft, ["2026-02", "2026-03"]);
    expect(next.has("2026-01")).toBe(false);
    expect(next.get("2026-04")).toBe(2);
  });
});

describe("rankForQuarter", () => {
  it("未設定四半期はランク 1", () => {
    expect(rankForQuarter("2026-04", new Map())).toBe(1);
    expect(rankForQuarter("2026-04", new Map([["2026-04", 3]]))).toBe(3);
  });
});

describe("rankBadgeForCell", () => {
  const priceMap = new Map<string, number>([
    ["2025-10", 850_000],
    ["2025-11", 850_000],
    ["2025-12", 850_000],
    ["2026-01", 850_000],
    ["2026-02", 850_000],
    ["2026-03", 850_000],
  ]);

  it("算出可能な四半期は未設定でも G-1 バッジ", () => {
    expect(rankBadgeForCell("2026-01", new Map(), priceMap)).toBe("G-1");
  });

  it("明示設定した四半期はそのランクを表示", () => {
    const draft = new Map([["2026-01", 2 as const]]);
    expect(rankBadgeForCell("2026-02", draft, priceMap)).toBe("G-2");
  });

  it("別四半期を選んでも他四半期のバッジは維持", () => {
    const draft = new Map([["2026-01", 3 as const]]);
    expect(rankBadgeForCell("2026-02", draft, priceMap)).toBe("G-3");
    expect(rankBadgeForCell("2026-04", draft, priceMap)).toBe("G-1");
  });
});

describe("pickerRankForSelection", () => {
  it("選択四半期の設定ランクを返す", () => {
    const draft = new Map([["2026-04", 2 as const]]);
    expect(pickerRankForSelection(["2026-04"], draft)).toBe(2);
    expect(pickerRankForSelection(["2026-01"], draft)).toBe(1);
  });
});

describe("salaryCellLabelForDraft", () => {
  const priceMap = new Map<string, number>([
    ["2025-10", 850_000],
    ["2025-11", 850_000],
    ["2025-12", 850_000],
    ["2026-01", 850_000],
    ["2026-02", 850_000],
    ["2026-03", 850_000],
  ]);

  it("Q1 の各月に同じ基本給（端数切り捨て）を表示", () => {
    const draft = new Map([["2026-01", 2 as const]]);
    const jan = salaryCellLabelForDraft("2026-01", priceMap, draft);
    const mar = salaryCellLabelForDraft("2026-03", priceMap, draft);
    expect(jan).toBe("46万円");
    expect(mar).toBe(jan);
  });

  it("未設定四半期はランク 1 で試算", () => {
    expect(salaryCellLabelForDraft("2026-01", priceMap, new Map())).toBe(
      "45万円",
    );
  });
});

describe("selectionKey", () => {
  it("順不同で同じキーになる", () => {
    expect(selectionKey(["2026-03", "2026-01"])).toBe("2026-01,2026-03");
  });
});

describe("rankBadgeLabel", () => {
  const priceMap = new Map<string, number>([
    ["2025-10", 850_000],
    ["2025-11", 850_000],
    ["2025-12", 850_000],
    ["2026-01", 850_000],
    ["2026-02", 850_000],
    ["2026-03", 850_000],
  ]);

  it("帯付きランクは G-2 形式", () => {
    expect(rankBadgeLabel("2026-01", 2, priceMap)).toBe("G-2");
  });
});

describe("DEFAULT_PICKER_RANK", () => {
  it("未設定四半期のデフォルトは 1", () => {
    expect(DEFAULT_PICKER_RANK).toBe(1);
  });
});

describe("monthSelectionRange", () => {
  it("月単位の連続範囲（単価入力用）", () => {
    const sel = monthSelectionRange("2026-02", "2026-04");
    expect([...sel].sort()).toEqual(["2026-02", "2026-03", "2026-04"]);
  });
});

describe("normalizeRankDraft", () => {
  it("effectiveFrom を四半期開始月に正規化", () => {
    const draft = normalizeRankDraft([
      { effectiveFrom: "2026-03", rank: 2 },
      { effectiveFrom: "2026-05", rank: 3 },
    ]);
    expect(draft.get("2026-01")).toBe(2);
    expect(draft.get("2026-04")).toBe(3);
  });
});

describe("formatSelectionQuartersLabel", () => {
  it("単一四半期", () => {
    expect(formatSelectionQuartersLabel(["2026-04"])).toBe("2026年4〜6月");
  });
});

describe("selectedQuarterStarts", () => {
  it("月選択から四半期開始月を抽出", () => {
    expect(
      selectedQuarterStarts(["2026-02", "2026-03", "2026-04"]),
    ).toEqual(["2026-01", "2026-04"]);
  });
});
