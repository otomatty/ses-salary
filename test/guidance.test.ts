import { describe, it, expect } from "vitest";
import {
  CONSULT_GUIDANCE,
  FIXED_GUIDANCE,
  CONSULT_THRESHOLD,
  FIXED_AMOUNT,
  FIXED_UPPER,
  guidanceForStatus,
  SALARY_CONTACT,
} from "../src/shared/guidance";
import { calcSalary, type PricePoint } from "../src/shared/calc";

function months(...prices: number[]): PricePoint[] {
  return prices.map((p, i) => ({ yearMonth: `2026-0${i + 1}`, unitPrice: p }));
}

describe("guidance thresholds", () => {
  it("早見表マスタからしきい値を導出する", () => {
    expect(CONSULT_THRESHOLD).toBe(1_400_000);
    expect(FIXED_AMOUNT).toBe(235_000);
    expect(FIXED_UPPER).toBe(400_000);
  });
});

describe("guidanceForStatus", () => {
  it("status に対応する案内を返す", () => {
    expect(guidanceForStatus("consult")).toBe(CONSULT_GUIDANCE);
    expect(guidanceForStatus("fixed")).toBe(FIXED_GUIDANCE);
    expect(guidanceForStatus("ok")).toBeNull();
  });

  it("各案内は理由と次の行動を含む", () => {
    for (const g of [CONSULT_GUIDANCE, FIXED_GUIDANCE]) {
      expect(g.badge).toBeTruthy();
      expect(g.headline).toBeTruthy();
      expect(g.reason.length).toBeGreaterThan(0);
      expect(g.nextAction.length).toBeGreaterThan(0);
    }
  });

  it("要相談の案内は相談窓口を明示する", () => {
    expect(CONSULT_GUIDANCE.nextAction).toContain(SALARY_CONTACT.desk);
  });
});

describe("calcSalary note は guidance と一致する", () => {
  it("要相談の note は理由＋次の行動", () => {
    const r = calcSalary(months(1_400_000, 1_400_000, 1_400_000), 1);
    expect(r.status).toBe("consult");
    expect(r.note).toBe(
      `${CONSULT_GUIDANCE.reason} ${CONSULT_GUIDANCE.nextAction}`,
    );
  });

  it("固定額の note は理由＋次の行動", () => {
    const r = calcSalary(months(300_000, 300_000, 300_000), 2);
    expect(r.status).toBe("fixed");
    expect(r.note).toBe(`${FIXED_GUIDANCE.reason} ${FIXED_GUIDANCE.nextAction}`);
  });
});
