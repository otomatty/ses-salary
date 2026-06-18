import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "../src/client/components/ThemeToggle";
import { ThemeProvider } from "../src/client/context/ThemeContext";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  // jsdom には matchMedia が無いのでスタブする（デフォルトはライト）。
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

describe("ThemeToggle（ヘッダーのテーマ切り替え）", () => {
  it("クリックでダーク／ライトを切り替え、html の dark クラスと localStorage に反映する", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    // 初期はライト（dark クラス無し）。
    const button = screen.getByRole("button", { name: "ダークモードに切り替え" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // クリックでダークへ。
    fireEvent.click(button);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "ライトモードに切り替え" }),
    ).toBeTruthy();

    // もう一度クリックでライトへ戻る。
    fireEvent.click(
      screen.getByRole("button", { name: "ライトモードに切り替え" }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("保存済みのダーク設定を初期表示で復元する", () => {
    localStorage.setItem("theme", "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(
      screen.getByRole("button", { name: "ライトモードに切り替え" }),
    ).toBeTruthy();
  });
});
