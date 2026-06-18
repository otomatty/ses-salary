import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { currentYearMonth } from "@shared/periods";
import {
  PriceInputTabs,
  type SinglePriceFormHandle,
} from "../src/client/components/PriceForms";

vi.mock("../src/client/api", () => ({
  api: {
    savePrice: vi.fn().mockResolvedValue({}),
    savePricesBulk: vi.fn().mockResolvedValue({}),
  },
}));

describe("PriceInputTabs (単発/一括の切り替え)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("単発入力タブと一括入力タブを切り替えられる", () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<PriceInputTabs reload={reload} />);

    // 初期は単発入力（「月単価（万円）」ラベルが見える）
    expect(screen.getByText("月単価（万円）")).toBeTruthy();
    expect(screen.queryByText("開始年月")).toBeNull();

    // 一括入力タブへ
    fireEvent.click(screen.getByRole("tab", { name: "一括入力" }));
    expect(screen.getByText("開始年月")).toBeTruthy();
    expect(screen.getByText("終了年月")).toBeTruthy();

    // 単発入力タブへ戻す
    fireEvent.click(screen.getByRole("tab", { name: "単発入力" }));
    expect(screen.getByText("月単価（万円）")).toBeTruthy();
  });

  it("setEdit ハンドルで一括入力から単発入力タブへ切り替わり値が反映される", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const ref = createRef<SinglePriceFormHandle>();
    render(<PriceInputTabs ref={ref} reload={reload} />);

    // 一括入力タブに移動しておく
    fireEvent.click(screen.getByRole("tab", { name: "一括入力" }));
    expect(screen.getByText("開始年月")).toBeTruthy();

    // 既存月の編集（円単位）を流し込む → 単発入力タブへ戻る
    ref.current!.setEdit("2026-05", 800000);

    // 単発入力パネルへ自動で切り替わる
    await waitFor(() => {
      expect(screen.getByText("月単価（万円）")).toBeTruthy();
      expect(screen.queryByText("開始年月")).toBeNull();
    });
    expect(
      (screen.getByRole("tab", { name: "単発入力" }) as HTMLElement).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");
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
    expect(api.savePrice).toHaveBeenCalledWith(currentYearMonth(), 750000);
    expect(reload).toHaveBeenCalled();
  });
});
