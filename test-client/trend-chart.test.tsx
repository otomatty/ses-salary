import { render } from "@testing-library/react";
import { describe, it, expect, beforeAll } from "vitest";
import { TrendChart } from "../src/client/components/TrendChart";
import { buildSalaryHistory } from "../src/shared/periods";
import type { MonthlyPriceDTO } from "../src/shared/types";

beforeAll(() => {
  // recharts の ResponsiveContainer は ResizeObserver と要素サイズを使う。
  // jsdom には無いので固定サイズで polyfill する。
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      width: 800,
      height: 400,
      top: 0,
      left: 0,
      right: 800,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON() {},
    }),
  });
});

/** recharts のラインの `d` から各頂点の x 座標を抽出する。 */
function curveXs(d: string): number[] {
  // "M x,y", "L x,y", "C cx1,cy1,cx2,cy2,x,y" の頂点（終点）x を拾う。
  const xs: number[] = [];
  // M/L の直後、および C の3点目（終点）の x を取る。
  const mPts = d.match(/[ML]([\d.]+),[\d.]+/g) ?? [];
  for (const m of mPts) xs.push(Number(m.slice(1).split(",")[0]));
  const cPts = d.match(/C[\d.]+,[\d.]+,[\d.]+,[\d.]+,([\d.]+),[\d.]+/g) ?? [];
  for (const c of cPts) {
    const parts = c.slice(1).split(",");
    xs.push(Number(parts[4]));
  }
  return xs;
}

describe("TrendChart", () => {
  it("月単価ラインが直近月（5・6月）まで給与ラインと同じ x スケールで描画される", () => {
    // 今日 = 2026-06 の想定。直近四半期(4〜6月)まで毎月入力済み。
    const months = [
      "2025-07", "2025-08", "2025-09",
      "2025-10", "2025-11", "2025-12",
      "2026-01", "2026-02", "2026-03",
      "2026-04", "2026-05", "2026-06",
    ];
    const prices: MonthlyPriceDTO[] = months.map((ym, i) => ({
      id: String(i),
      yearMonth: ym,
      unitPrice: 950000,
    }));
    const history = buildSalaryHistory(
      prices.map((p) => ({ yearMonth: p.yearMonth, unitPrice: p.unitPrice })),
      [],
      1,
      null,
    );

    const { container } = render(
      <div style={{ width: 800, height: 400 }}>
        <TrendChart prices={prices} history={history} />
      </div>,
    );

    const curves = Array.from(
      container.querySelectorAll("path.recharts-line-curve"),
    ).map((p) => ({
      stroke: (p.getAttribute("stroke") || "").toLowerCase(),
      d: p.getAttribute("d") || "",
    }));

    const purple = curves.find((c) => c.stroke === "#6366f1");
    const green = curves.find((c) => c.stroke === "#10b981");
    expect(purple, "月単価ラインが存在する").toBeTruthy();
    expect(green, "給与ラインが存在する").toBeTruthy();

    const purpleXs = curveXs(purple!.d);
    const greenXs = curveXs(green!.d);

    // 月単価ラインは全12ヶ月ぶんの頂点を持つ。
    expect(purpleXs.length).toBe(months.length);

    // 月単価ラインの右端は、給与ライン（来期 2026-07 の点まで延びる）の右端より
    // 1ヶ月ぶん手前で止まる（直近月 2026-06 まで描かれている）。
    // バグ時は月単価ラインが別スケールに乗って途中で折り返し、右端が大きく手前に
    // なっていた。両ラインが同一スケールなら、月単価の右端＝給与右端−1区間。
    const purpleMaxX = Math.max(...purpleXs);
    const greenMaxX = Math.max(...greenXs);
    const step = greenXs[1] - greenXs[0]; // 給与は四半期間隔だが、軸の1区間=1ヶ月。
    // 給与点は四半期ごと（3ヶ月間隔）。1ヶ月ぶんの区間幅を逆算する。
    const monthStep = step / 3;
    expect(purpleMaxX).toBeGreaterThan(greenMaxX - monthStep * 1.5);
    expect(purpleMaxX).toBeLessThan(greenMaxX);

    // 単調増加（折り返さない）こと＝同一スケールに正しく乗っている証拠。
    for (let i = 1; i < purpleXs.length; i++) {
      expect(purpleXs[i]).toBeGreaterThan(purpleXs[i - 1]);
    }
  });
});
