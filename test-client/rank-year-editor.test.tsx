import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Rank } from "@shared/rateTable";
import { RankYearEditor } from "../src/client/components/RankYearEditor";

const priceMap = new Map<string, number>([
  ["2025-07", 850_000],
  ["2025-08", 850_000],
  ["2025-09", 850_000],
  ["2025-10", 850_000],
  ["2025-11", 850_000],
  ["2025-12", 850_000],
  ["2026-01", 850_000],
  ["2026-02", 850_000],
  ["2026-03", 850_000],
  ["2026-04", 850_000],
  ["2026-05", 850_000],
  ["2026-06", 850_000],
]);

function monthCell(label: RegExp) {
  return screen.getByRole("option", { name: label });
}

function rankOption(rank: 1 | 2 | 3) {
  return document.querySelector(
    `[data-rank="${rank}"]`,
  ) as HTMLButtonElement;
}

function badgeTexts(): string[] {
  return [...document.querySelectorAll(".year-month-strip__cell-badge")].map(
    (el) => el.textContent ?? "",
  );
}

describe("RankYearEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("算出可能な四半期はデフォルトで G-1 バッジを表示", () => {
    render(
      <RankYearEditor
        value={new Map()}
        onChange={vi.fn()}
        priceMap={priceMap}
        endMonth="2026-06"
      />,
    );

    expect(badgeTexts().filter((t) => t === "G-1").length).toBeGreaterThan(0);
  });

  it("四半期選択でランク即反映・バッジは四半期の3ヶ月分", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RankYearEditor
        value={new Map()}
        onChange={onChange}
        priceMap={priceMap}
        endMonth="2026-06"
      />,
    );

    fireEvent.pointerDown(monthCell(/2026年3月/));
    fireEvent.click(rankOption(2));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as Map<string, number>;
    expect(next.get("2026-01")).toBe(2);

    rerender(
      <RankYearEditor
        value={next}
        onChange={onChange}
        priceMap={priceMap}
        endMonth="2026-06"
      />,
    );
    expect(badgeTexts().filter((t) => t === "G-2")).toHaveLength(3);
  });

  it("別四半期を選んでも先に設定した四半期のバッジが残る", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RankYearEditor
        value={new Map()}
        onChange={onChange}
        priceMap={priceMap}
        endMonth="2026-06"
      />,
    );

    fireEvent.pointerDown(monthCell(/2026年3月/));
    fireEvent.click(rankOption(3));
    const draft = onChange.mock.calls[0]![0] as Map<string, Rank>;

    rerender(
      <RankYearEditor
        value={draft}
        onChange={onChange}
        priceMap={priceMap}
        endMonth="2026-06"
      />,
    );
    expect(badgeTexts().filter((t) => t === "G-3")).toHaveLength(3);

    fireEvent.pointerDown(monthCell(/2026年4月/));
    expect(badgeTexts().filter((t) => t === "G-3")).toHaveLength(3);
    expect(badgeTexts().filter((t) => t === "G-1").length).toBeGreaterThan(0);
  });

  it("基本給は端数切り捨てで表示", () => {
    render(
      <RankYearEditor
        value={new Map([["2026-04", 2]])}
        onChange={vi.fn()}
        priceMap={priceMap}
        endMonth="2026-06"
      />,
    );

    expect(monthCell(/2026年4月/).textContent).toContain("46万円");
    expect(monthCell(/2026年4月/).textContent).not.toMatch(/\d\.\d+万円/);
  });
});
