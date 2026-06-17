import { describe, it, expect, beforeEach } from "vitest";
import { postJson, request, login } from "./helpers";
import {
  currentYearMonth,
  quarterStartMonth,
  prevQuarterStart,
  nextQuarterStart,
  quarterMonths,
} from "@shared/periods";

// 基準四半期はテスト群を通して一度だけ固定する。
// 実行中に月/四半期が切り替わっても、投入月と検証月がズレないようにするため。
const baseYm = currentYearMonth();
const currentQ = quarterStartMonth(baseYm);
const prevQ = prevQuarterStart(currentQ);
const nextQ = nextQuarterStart(currentQ);
// 今期の基準＝前四半期の3ヶ月。来期の基準＝今四半期の3ヶ月。
const prevQMonths = quarterMonths(prevQ);
const currentQMonths = quarterMonths(currentQ);

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

  it("前四半期・今四半期が揃うと今期・来期を算出し、来期スナップショットを永続化する", async () => {
    // 前四半期（今期の基準）と今四半期（来期の基準）を 100万 で埋める。
    for (const ym of [...prevQMonths, ...currentQMonths]) {
      await postJson("/api/prices", { yearMonth: ym, unitPrice: 1_000_000 }, cookie);
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

    // 今期: 前四半期平均100万・暫定ランク1 → I帯 54.52% = 545,200
    expect(body.current?.breakdown.band.code).toBe("I");
    expect(body.current?.breakdown.salary).toBe(545_200);
    // 来期（今四半期の平均が基準、次の四半期に適用）
    expect(body.next?.appliedFrom).toBe(nextQ);
    expect(body.next?.breakdown.salary).toBe(545_200);

    // 単価 POST 時に来期スナップショットが salary_results へ保存されている（PRD §9）
    const snap = body.savedResults.find((r) => r.appliedFrom === nextQ);
    expect(snap).toBeDefined();
    expect(snap?.salary).toBe(545_200);
    expect(snap?.appliedBand).toBe("I");
    expect(snap?.status).toBe("ok");
  });

  it("境界値: 平均1,400,000は要相談（来期 salary が null・スナップショットも consult）", async () => {
    // 来期の基準＝今四半期の3ヶ月を 1,400,000 で埋める。
    for (const ym of currentQMonths) {
      await postJson("/api/prices", { yearMonth: ym, unitPrice: 1_400_000 }, cookie);
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
