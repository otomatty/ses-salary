import { describe, it, expect, beforeEach } from "vitest";
import { postJson, request, login } from "./helpers";
import { currentYearMonth, addMonths } from "@shared/periods";

// 基準月はテスト群を通して一度だけ固定する。
// 実行中に月が切り替わっても、投入月と検証月がズレないようにするため。
const baseYm = currentYearMonth();
const nextYm = addMonths(baseYm, 1);

/** baseYm を基準に n ヶ月前の "YYYY-MM" を返す。 */
function monthsAgo(n: number): string {
  return addMonths(baseYm, -n);
}

describe("/api/dashboard", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("データが空のときは nextPending を返し、今期・来期・履歴は空", async () => {
    const res = await request("/api/dashboard", {}, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      current: unknown;
      next: unknown;
      history: unknown[];
      savedResults: unknown[];
      nextPending: string | null;
    };
    expect(body.current).toBeNull();
    expect(body.next).toBeNull();
    expect(body.history).toEqual([]);
    expect(body.savedResults).toEqual([]);
    expect(body.nextPending).toContain("月単価がまだ登録されていません");
  });

  it("直近3ヶ月が揃うと今期・来期を算出し、来期スナップショットを永続化する", async () => {
    // 当月までの直近4ヶ月（今期と来期の両方を算出できるようにする）。
    for (const n of [3, 2, 1, 0]) {
      await postJson(
        "/api/prices",
        { yearMonth: monthsAgo(n), unitPrice: 1_000_000 },
        cookie,
      );
    }

    const res = await request("/api/dashboard", {}, cookie);
    const body = (await res.json()) as {
      current: { breakdown: { salary: number; band: { code: string } } } | null;
      next: { appliedFrom: string; breakdown: { salary: number } } | null;
      savedResults: {
        appliedFrom: string;
        salary: number | null;
        appliedBand: string;
        status: string;
      }[];
    };

    // 今期: 平均100万・暫定ランク2 → I帯 55.89% = 558,900
    expect(body.current?.breakdown.band.code).toBe("I");
    expect(body.current?.breakdown.salary).toBe(558_900);
    // 来期（最新単価=当月 の翌月適用）
    expect(body.next?.appliedFrom).toBe(nextYm);
    expect(body.next?.breakdown.salary).toBe(558_900);

    // 単価 POST 時に来期スナップショットが salary_results へ保存されている（PRD §9）
    const snap = body.savedResults.find(
      (r) => r.appliedFrom === nextYm,
    );
    expect(snap).toBeDefined();
    expect(snap?.salary).toBe(558_900);
    expect(snap?.appliedBand).toBe("I");
    expect(snap?.status).toBe("ok");
  });

  it("境界値: 平均1,400,000は要相談（来期 salary が null・スナップショットも consult）", async () => {
    // 来期(当月+1)の直前3ヶ月 = 当月-2..当月 を 1,400,000 で埋める。
    for (const n of [2, 1, 0]) {
      await postJson(
        "/api/prices",
        { yearMonth: monthsAgo(n), unitPrice: 1_400_000 },
        cookie,
      );
    }
    const res = await request("/api/dashboard", {}, cookie);
    const body = (await res.json()) as {
      next: { breakdown: { status: string; salary: number | null } } | null;
      savedResults: { appliedBand: string; status: string; salary: number | null }[];
    };
    expect(body.next?.breakdown.status).toBe("consult");
    expect(body.next?.breakdown.salary).toBeNull();

    const snap = body.savedResults.at(-1);
    expect(snap?.status).toBe("consult");
    expect(snap?.appliedBand).toBe("M");
    expect(snap?.salary).toBeNull();
  });
});
