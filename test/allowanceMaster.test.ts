import { describe, it, expect } from "vitest";
import {
  ALLOWANCE_MASTER,
  findAllowanceDefinition,
  isKnownAllowanceName,
  normalizeAllowanceItem,
} from "../src/shared/allowanceMaster";

describe("allowanceMaster", () => {
  it("TL手当は残業基礎に含む", () => {
    const def = findAllowanceDefinition("TL手当");
    expect(def?.includeInOvertimeBase).toBe(true);
    expect(def?.defaultAmount).toBe(20_000);
  });

  it("通勤手当は残業基礎に含まない", () => {
    expect(findAllowanceDefinition("通勤手当")?.includeInOvertimeBase).toBe(false);
  });

  it("未登録名は normalize でエラー", () => {
    const r = normalizeAllowanceItem("カスタム手当", 1000);
    expect("error" in r).toBe(true);
  });

  it("normalize はマスタから includeInOvertimeBase を決定する", () => {
    const r = normalizeAllowanceItem("TL手当", 15_000);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.includeInOvertimeBase).toBe(true);
    expect(r.amount).toBe(15_000);
  });

  it("マスタ名一覧は固定件数", () => {
    expect(ALLOWANCE_MASTER.length).toBeGreaterThanOrEqual(6);
    expect(isKnownAllowanceName("TL手当")).toBe(true);
    expect(isKnownAllowanceName("未知")).toBe(false);
  });
});
