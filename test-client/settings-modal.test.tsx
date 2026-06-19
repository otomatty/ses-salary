import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Settings } from "../src/client/pages/Settings";
import type { DashboardResponse } from "@shared/types";

vi.mock("../src/client/api", () => ({
  api: {
    saveRank: vi.fn().mockResolvedValue({}),
    deleteRank: vi.fn().mockResolvedValue({}),
    deleteAllData: vi.fn().mockResolvedValue({}),
  },
}));

const dashboard: DashboardResponse = {
  prices: [],
  rankHistory: [],
  currentRank: 1,
  rankProvisional: false,
  current: null,
  next: null,
  history: [],
  savedResults: [],
  nextPending: null,
  allowances: [],
  overtime: [],
  settings: {
    employmentType: "fulltime_engineer",
    monthlyStandardHours: 160,
    deemedOvertimeHours: null,
    consultRate: null,
  },
  currentMonthIncome: null,
};

const HEADING = "本当にすべてのデータを削除しますか？";
const btn = (label: string) =>
  screen.getByText(label).closest("button") as HTMLButtonElement;

describe("Settings danger-zone modal (controlled HeroUI Modal)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens on trigger, enables confirm only after the phrase, deletes, then closes", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<Settings dashboard={dashboard} reload={reload} />);

    expect(screen.queryByText(HEADING)).toBeNull();

    fireEvent.click(screen.getByText("すべてのデータを削除"));
    await waitFor(() => expect(screen.queryByText(HEADING)).not.toBeNull());

    expect(btn("削除する").disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "削除します" },
    });
    await waitFor(() => expect(btn("削除する").disabled).toBe(false));

    const { api } = await import("../src/client/api");
    fireEvent.click(btn("削除する"));
    await waitFor(() => expect(api.deleteAllData).toHaveBeenCalledTimes(1));
    expect(reload).toHaveBeenCalled();

    await waitFor(() => expect(screen.queryByText(HEADING)).toBeNull());
  });

  it("closes on cancel without deleting", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(<Settings dashboard={dashboard} reload={reload} />);

    fireEvent.click(screen.getByText("すべてのデータを削除"));
    await waitFor(() => expect(screen.queryByText(HEADING)).not.toBeNull());

    fireEvent.click(btn("キャンセル"));
    await waitFor(() => expect(screen.queryByText(HEADING)).toBeNull());

    const { api } = await import("../src/client/api");
    expect(api.deleteAllData).not.toHaveBeenCalled();
  });
});
