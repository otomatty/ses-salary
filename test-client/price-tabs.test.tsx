import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  PriceInputTabs,
  validateManYenPrice,
} from "../src/client/components/PriceForms";

// 月境界でのフレークを避けるため「現在年月」を固定する（描画時と検証時で月がズレない）。
const FIXED_YM = "2026-05";

vi.mock("@shared/periods", async () => {
  const actual =
    await vi.importActual<typeof import("@shared/periods")>("@shared/periods");
  return { ...actual, currentYearMonth: () => FIXED_YM };
});

vi.mock("../src/client/api", () => ({
  api: {
    savePrice: vi.fn().mockResolvedValue({}),
    savePricesBulk: vi.fn().mockResolvedValue({}),
  },
}));

describe("validateManYenPrice", () => {
  it("空欄・0以下・非数は不正、正の数は妥当", () => {
    expect(validateManYenPrice(null)).not.toBeNull();
    expect(validateManYenPrice(0)).not.toBeNull();
    expect(validateManYenPrice(-1)).not.toBeNull();
    expect(validateManYenPrice(NaN)).not.toBeNull();
    expect(validateManYenPrice(80)).toBeNull();
  });
});

describe("PriceInputTabs（単発/一括の切り替え）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("単発入力タブと一括入力タブを切り替えられる（非制御）", () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<PriceInputTabs reload={reload} />);

    // 初期は単発入力
    expect(screen.getByText("月単価（万円）")).toBeTruthy();
    expect(screen.queryByText("開始年月")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "一括入力" }));
    expect(screen.getByText("開始年月")).toBeTruthy();
    expect(screen.getByText("終了年月")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "単発入力" }));
    expect(screen.getByText("月単価（万円）")).toBeTruthy();
  });

  it("editTarget を渡すと単発フォームに対象月が反映される（props 経由）", () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(
      <PriceInputTabs
        reload={reload}
        tab="single"
        editTarget={{ yearMonth: "2026-05", unitPrice: 800000 }}
      />,
    );

    // 年月の month 入力に対象月が反映される（通常の制御 input なので値を検証できる）
    expect(screen.getByDisplayValue("2026-05")).toBeTruthy();
  });

  it("制御 props で指定したタブが表示される", () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const onTabChange = vi.fn();
    render(
      <PriceInputTabs reload={reload} tab="bulk" onTabChange={onTabChange} />,
    );

    expect(screen.getByText("開始年月")).toBeTruthy();
    // タブをクリックすると親へ通知される
    fireEvent.click(screen.getByRole("tab", { name: "単発入力" }));
    expect(onTabChange).toHaveBeenCalledWith("single");
  });

  it("単発入力で保存すると api.savePrice が呼ばれる", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<PriceInputTabs reload={reload} />);

    // React Aria NumberField は blur でコミットされる
    const input = screen.getByPlaceholderText("例: 80");
    fireEvent.change(input, { target: { value: "75" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    const { api } = await import("../src/client/api");
    await waitFor(() => expect(api.savePrice).toHaveBeenCalledTimes(1));
    expect(api.savePrice).toHaveBeenCalledWith(FIXED_YM, 750000);
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });
});
