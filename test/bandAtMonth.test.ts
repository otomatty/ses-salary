import { describe, expect, it } from "vitest";
import { bandAtMonth, bandKeyAtMonth } from "../src/shared/bandAtMonth";

describe("bandAtMonth", () => {
  const priceMap = new Map<string, number>([
    ["2025-10", 850_000],
    ["2025-11", 850_000],
    ["2025-12", 850_000],
    ["2026-01", 850_000],
    ["2026-02", 850_000],
    ["2026-03", 850_000],
    ["2026-04", 1_000_000],
    ["2026-05", 1_000_000],
    ["2026-06", 1_000_000],
  ]);

  it("直前四半期の単価が揃う月は帯を返す", () => {
    const band = bandAtMonth("2026-04", priceMap);
    expect(band?.code).toBe("G");
  });

  it("単価が不足する月は null", () => {
    expect(bandAtMonth("2025-07", priceMap)).toBeNull();
  });

  it("bandKeyAtMonth は帯コードを返す", () => {
    expect(bandKeyAtMonth("2026-07", priceMap)).toBe("I");
  });
});
