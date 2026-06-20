import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BottomNav } from "../src/client/components/BottomNav";

/** ナビ対象の4ルートを持つメモリルーターで ui を描画する。 */
function renderWithRouter(ui: ReactNode, initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        {ui}
        <Outlet />
      </>
    ),
  });
  const children = ["/", "/prices", "/detail", "/simulate"].map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  // テスト用の独立ルーターのため登録済み型と一致しないが、実行時の挙動のみ検証する。
  render(<RouterProvider router={router as never} />);
}

describe("BottomNav（モバイル用ボトムナビ）", () => {
  it("4項目を表示する", async () => {
    renderWithRouter(<BottomNav />, "/");
    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(4);
    for (const name of ["ホーム", "月別入力", "給与の詳細", "単価シミュレーション"]) {
      expect(screen.getByRole("link", { name })).toBeTruthy();
    }
  });

  it("現在ルートのリンクに data-status=active を付ける", async () => {
    renderWithRouter(<BottomNav />, "/prices");
    const active = await screen.findByRole("link", { name: "月別入力" });
    await waitFor(() =>
      expect(active.getAttribute("data-status")).toBe("active"),
    );
    // ホームは完全一致のため /prices ではアクティブにならない。
    expect(
      screen.getByRole("link", { name: "ホーム" }).getAttribute("data-status"),
    ).not.toBe("active");
  });
});
