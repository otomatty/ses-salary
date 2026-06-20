import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NavMenu } from "../src/client/components/NavMenu";

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
  render(<RouterProvider router={router as never} />);
}

describe("NavMenu（デスクトップ用ヘッダーメニュー）", () => {
  it("初期状態ではグリッドを閉じている", async () => {
    renderWithRouter(<NavMenu />, "/");
    // トリガーは表示されるが、項目リンクはまだ出ていない。
    await screen.findByRole("button", { name: "メニューを開く" });
    expect(screen.queryByRole("link", { name: "月別入力" })).toBeNull();
  });

  it("トリガー押下でグリッドが開き4項目を表示する", async () => {
    renderWithRouter(<NavMenu />, "/");
    const trigger = await screen.findByRole("button", { name: "メニューを開く" });
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /月別入力/ })).toBeTruthy(),
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
  });
});
