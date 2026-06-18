import { describe, it, expect, beforeEach } from "vitest";
import { postJson, request, login } from "./helpers";
import {
  currentYearMonth,
  quarterStartMonth,
  prevQuarterStart,
  quarterMonths,
} from "@shared/periods";
import type { DashboardResponse } from "@shared/types";

const baseYm = currentYearMonth();
const currentQ = quarterStartMonth(baseYm);
const prevQ = prevQuarterStart(currentQ);
// 今期の基準＝前四半期の3ヶ月。
const prevQMonths = quarterMonths(prevQ);

function dashboard(cookie: string) {
  return request("/api/dashboard", {}, cookie).then(
    (r) => r.json() as Promise<DashboardResponse>,
  );
}

describe("/api/allowances", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("POST で新規作成し 201、GET（dashboard）で取得できる", async () => {
    const res = await postJson(
      "/api/allowances",
      {
        name: "役職手当",
        effectiveFrom: "2026-01",
        amount: 30_000,
        includeInOvertimeBase: false,
      },
      cookie,
    );
    expect(res.status).toBe(201);
    const body = await dashboard(cookie);
    expect(body.allowances).toHaveLength(1);
    expect(body.allowances[0].name).toBe("役職手当");
    expect(body.allowances[0].amount).toBe(30_000);
    expect(body.allowances[0].includeInOvertimeBase).toBe(false);
  });

  it("同じ手当名・適用開始月への POST は upsert（更新）", async () => {
    await postJson(
      "/api/allowances",
      { name: "役職手当", effectiveFrom: "2026-01", amount: 30_000, includeInOvertimeBase: false },
      cookie,
    );
    const second = await postJson(
      "/api/allowances",
      { name: "役職手当", effectiveFrom: "2026-01", amount: 50_000, includeInOvertimeBase: true },
      cookie,
    );
    expect(second.status).toBe(200);
    const body = await dashboard(cookie);
    expect(body.allowances).toHaveLength(1);
    expect(body.allowances[0].amount).toBe(50_000);
    expect(body.allowances[0].includeInOvertimeBase).toBe(true);
  });

  it("DELETE で削除できる", async () => {
    const created = await postJson(
      "/api/allowances",
      { name: "資格手当", effectiveFrom: "2026-01", amount: 10_000, includeInOvertimeBase: false },
      cookie,
    );
    const id = ((await created.json()) as { allowance: { id: string } }).allowance.id;
    const del = await request(`/api/allowances/${id}`, { method: "DELETE" }, cookie);
    expect(del.status).toBe(200);
    const body = await dashboard(cookie);
    expect(body.allowances).toHaveLength(0);
  });

  it("手当名が空・金額が不正なら 400", async () => {
    const noName = await postJson(
      "/api/allowances",
      { name: "  ", effectiveFrom: "2026-01", amount: 1000, includeInOvertimeBase: false },
      cookie,
    );
    expect(noName.status).toBe(400);
    const badAmount = await postJson(
      "/api/allowances",
      { name: "役職手当", effectiveFrom: "2026-01", amount: -1, includeInOvertimeBase: false },
      cookie,
    );
    expect(badAmount.status).toBe(400);
  });
});

describe("/api/overtime", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("POST で新規作成・同月への再POSTは upsert", async () => {
    const first = await postJson(
      "/api/overtime",
      { yearMonth: baseYm, normalHours: 30, nightHours: 0, holidayHours: 0 },
      cookie,
    );
    expect(first.status).toBe(201);
    const second = await postJson(
      "/api/overtime",
      { yearMonth: baseYm, normalHours: 40, nightHours: 2, holidayHours: 0 },
      cookie,
    );
    expect(second.status).toBe(200);
    const body = await dashboard(cookie);
    expect(body.overtime).toHaveLength(1);
    expect(body.overtime[0].normalHours).toBe(40);
    expect(body.overtime[0].nightHours).toBe(2);
  });

  it("負の時間・上限超過は 400", async () => {
    const neg = await postJson(
      "/api/overtime",
      { yearMonth: baseYm, normalHours: -1, nightHours: 0, holidayHours: 0 },
      cookie,
    );
    expect(neg.status).toBe(400);
    const over = await postJson(
      "/api/overtime",
      { yearMonth: baseYm, normalHours: 1000, nightHours: 0, holidayHours: 0 },
      cookie,
    );
    expect(over.status).toBe(400);
  });

  it("DELETE で削除できる", async () => {
    const created = await postJson(
      "/api/overtime",
      { yearMonth: baseYm, normalHours: 30, nightHours: 0, holidayHours: 0 },
      cookie,
    );
    const id = ((await created.json()) as { overtime: { id: string } }).overtime.id;
    const del = await request(`/api/overtime/${id}`, { method: "DELETE" }, cookie);
    expect(del.status).toBe(200);
    const body = await dashboard(cookie);
    expect(body.overtime).toHaveLength(0);
  });
});

describe("/api/settings", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("未設定時は既定値を返す", async () => {
    const body = await dashboard(cookie);
    expect(body.settings.employmentType).toBe("fulltime_engineer");
    expect(body.settings.monthlyStandardHours).toBe(160);
  });

  it("POST で雇用形態・所定労働時間を保存できる（upsert）", async () => {
    const res = await postJson(
      "/api/settings",
      { employmentType: "contract_academia", monthlyStandardHours: 150, deemedOvertimeHours: null },
      cookie,
    );
    expect(res.status).toBe(200);
    const body = await dashboard(cookie);
    expect(body.settings.employmentType).toBe("contract_academia");
    expect(body.settings.monthlyStandardHours).toBe(150);

    // 再保存で上書き
    await postJson(
      "/api/settings",
      { employmentType: "fulltime_engineer", monthlyStandardHours: 160, deemedOvertimeHours: null },
      cookie,
    );
    const body2 = await dashboard(cookie);
    expect(body2.settings.employmentType).toBe("fulltime_engineer");
  });

  it("不正な雇用形態・所定労働時間は 400", async () => {
    const badType = await postJson(
      "/api/settings",
      { employmentType: "xxx", monthlyStandardHours: 160, deemedOvertimeHours: null },
      cookie,
    );
    expect(badType.status).toBe(400);
    const badHours = await postJson(
      "/api/settings",
      { employmentType: "fulltime_engineer", monthlyStandardHours: 0, deemedOvertimeHours: null },
      cookie,
    );
    expect(badHours.status).toBe(400);
  });
});

describe("/api/dashboard currentMonthIncome", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("基本給に当月の手当・残業を加算した月収を返す", async () => {
    // 前四半期を 80万 で埋める → 今期基本給 = 80万 × G帯ランク1(53.23%) = 425,840
    for (const ym of prevQMonths) {
      await postJson("/api/prices", { yearMonth: ym, unitPrice: 800_000 }, cookie);
    }
    // 設定: 所定150h・正社員（みなし20h）
    await postJson(
      "/api/settings",
      { employmentType: "fulltime_engineer", monthlyStandardHours: 150, deemedOvertimeHours: null },
      cookie,
    );
    // 手当（職務手当 2万・残業基礎に算入）＋ 当月残業 30h
    await postJson(
      "/api/allowances",
      { name: "職務手当", effectiveFrom: prevQMonths[0], amount: 20_000, includeInOvertimeBase: true },
      cookie,
    );
    await postJson(
      "/api/overtime",
      { yearMonth: baseYm, normalHours: 30, nightHours: 0, holidayHours: 0 },
      cookie,
    );

    const body = await dashboard(cookie);
    const baseSalary = body.current?.breakdown.salary ?? null;
    expect(baseSalary).toBe(425_840);
    expect(body.currentMonthIncome).not.toBeNull();
    const inc = body.currentMonthIncome!;
    // 時給基礎 = (425,840 + 20,000) / 150 = 2,972.27。支給10h × 1.25 = round(37,153.3) = 37,153
    const hourly = (425_840 + 20_000) / 150;
    const expectedOt = Math.round(hourly * 1.25 * 10);
    expect(inc.allowanceTotal).toBe(20_000);
    expect(inc.overtimePay).toBe(expectedOt);
    expect(inc.gross).toBe(425_840 + 20_000 + expectedOt);
  });
});
