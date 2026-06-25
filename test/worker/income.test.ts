import { describe, it, expect, beforeEach } from "vitest";
import { postJson, request, login } from "./helpers";
import {
  addMonths,
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

describe("POST /api/months（単価・残業・手当をまとめて保存）", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("単価・残業・手当を保存し dashboard に反映される", async () => {
    const res = await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 850_000,
        overtime: { normalHours: 30, nightHours: 1, holidayHours: 0 },
        allowances: [
          { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
          { name: "通勤手当", amount: 8_330, includeInOvertimeBase: false },
        ],
      },
      cookie,
    );
    expect(res.status).toBe(200);

    const body = await dashboard(cookie);
    expect(body.prices.find((p) => p.yearMonth === baseYm)?.unitPrice).toBe(
      850_000,
    );
    const ot = body.overtime.find((o) => o.yearMonth === baseYm);
    expect(ot?.normalHours).toBe(30);
    expect(ot?.nightHours).toBe(1);
    expect(body.allowances.filter((a) => a.yearMonth === baseYm)).toHaveLength(2);
    const job = body.allowances.find(
      (a) => a.yearMonth === baseYm && a.name === "TL手当",
    );
    const commute = body.allowances.find(
      (a) => a.yearMonth === baseYm && a.name === "通勤手当",
    );
    expect(job?.includeInOvertimeBase).toBe(true);
    expect(commute?.includeInOvertimeBase).toBe(false);
  });

  it("クライアントが誤った includeInOvertimeBase を送ってもマスタで上書きする", async () => {
    await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 850_000,
        overtime: { normalHours: 0, nightHours: 0, holidayHours: 0 },
        allowances: [
          { name: "TL手当", amount: 20_000, includeInOvertimeBase: false },
        ],
      },
      cookie,
    );
    const body = await dashboard(cookie);
    const job = body.allowances.find(
      (a) => a.yearMonth === baseYm && a.name === "TL手当",
    );
    expect(job?.includeInOvertimeBase).toBe(true);
  });

  it("再保存は同月分を入れ替える（手当を減らすと反映される）", async () => {
    await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 850_000,
        overtime: { normalHours: 30, nightHours: 0, holidayHours: 0 },
        allowances: [
          { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
          { name: "通勤手当", amount: 8_330, includeInOvertimeBase: false },
        ],
      },
      cookie,
    );
    await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 860_000,
        overtime: { normalHours: 10, nightHours: 0, holidayHours: 0 },
        allowances: [
          { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
        ],
      },
      cookie,
    );
    const body = await dashboard(cookie);
    expect(body.prices.find((p) => p.yearMonth === baseYm)?.unitPrice).toBe(
      860_000,
    );
    expect(body.allowances.filter((a) => a.yearMonth === baseYm)).toHaveLength(1);
    expect(body.overtime.find((o) => o.yearMonth === baseYm)?.normalHours).toBe(
      10,
    );
  });

  it("DELETE /api/months/:yearMonth でその月をすべて削除", async () => {
    await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 850_000,
        overtime: { normalHours: 5, nightHours: 0, holidayHours: 0 },
        allowances: [
          { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
        ],
      },
      cookie,
    );
    const del = await request(`/api/months/${baseYm}`, { method: "DELETE" }, cookie);
    expect(del.status).toBe(200);
    const body = await dashboard(cookie);
    expect(body.prices.some((p) => p.yearMonth === baseYm)).toBe(false);
    expect(body.allowances.some((a) => a.yearMonth === baseYm)).toBe(false);
  });

  it("不正な残業時間・手当・単価は 400", async () => {
    const badHours = await postJson(
      `/api/months/${baseYm}`,
      { unitPrice: 850_000, overtime: { normalHours: -1 }, allowances: [] },
      cookie,
    );
    expect(badHours.status).toBe(400);

    const badAllowance = await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 850_000,
        overtime: {},
        allowances: [{ name: "", amount: 1000, includeInOvertimeBase: false }],
      },
      cookie,
    );
    expect(badAllowance.status).toBe(400);

    const unknownAllowance = await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 850_000,
        overtime: {},
        allowances: [{ name: "未知手当", amount: 1000, includeInOvertimeBase: false }],
      },
      cookie,
    );
    expect(unknownAllowance.status).toBe(200);
    const afterUnknown = await dashboard(cookie);
    expect(
      afterUnknown.allowances.find(
        (a) => a.yearMonth === baseYm && a.name === "未知手当",
      ),
    ).toEqual(
      expect.objectContaining({ amount: 1000, includeInOvertimeBase: false }),
    );

    const badPrice = await postJson(
      `/api/months/${baseYm}`,
      { unitPrice: -1, overtime: {}, allowances: [] },
      cookie,
    );
    expect(badPrice.status).toBe(400);
  });

  it("手当のみ保存（単価省略）で unitPrice 0 の行ができ、prices 一覧には出ない", async () => {
    const ym = "2099-01";
    const res = await postJson(
      `/api/months/${ym}`,
      {
        allowances: [
          { name: "通勤手当", amount: 5000, includeInOvertimeBase: false },
        ],
      },
      cookie,
    );
    expect(res.status).toBe(200);
    const body = await dashboard(cookie);
    expect(body.prices.some((p) => p.yearMonth === ym)).toBe(false);
    expect(
      body.allowances.filter((a) => a.yearMonth === ym),
    ).toHaveLength(1);
  });

  it("残業のみ更新で単価・手当は維持される", async () => {
    await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 850_000,
        overtime: { normalHours: 5, nightHours: 0, holidayHours: 0 },
        allowances: [
          { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
        ],
      },
      cookie,
    );
    await postJson(
      `/api/months/${baseYm}`,
      { overtime: { normalHours: 25, nightHours: 1, holidayHours: 0 } },
      cookie,
    );
    const body = await dashboard(cookie);
    expect(body.prices.find((p) => p.yearMonth === baseYm)?.unitPrice).toBe(
      850_000,
    );
    expect(body.overtime.find((o) => o.yearMonth === baseYm)?.normalHours).toBe(
      25,
    );
    expect(body.allowances.filter((a) => a.yearMonth === baseYm)).toHaveLength(1);
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
    // 当月（baseYm）にTL手当2万（残業基礎）＋ 残業30h を登録
    await postJson(
      `/api/months/${baseYm}`,
      {
        unitPrice: 800_000,
        overtime: { normalHours: 30, nightHours: 0, holidayHours: 0 },
        allowances: [
          { name: "TL手当", amount: 20_000, includeInOvertimeBase: true },
        ],
      },
      cookie,
    );

    const body = await dashboard(cookie);
    const baseSalary = body.current?.breakdown.salary ?? null;
    expect(baseSalary).toBe(425_840);
    expect(body.currentMonthIncome).not.toBeNull();
    const inc = body.currentMonthIncome!;
    // 時給基礎 = (425,840 + 20,000) / (150 + 1.25×20=25 → 175)。支給10h × 1.25。
    const hourly = (425_840 + 20_000) / 175;
    const expectedOt = Math.round(hourly * 1.25 * 10);
    expect(inc.allowanceTotal).toBe(20_000);
    expect(inc.overtimePay).toBe(expectedOt);
    expect(inc.gross).toBe(425_840 + 20_000 + expectedOt);
  });
});

describe("/api/dashboard annualIncome（直近12カ月の年収）", () => {
  let cookie: string;
  beforeEach(async () => {
    cookie = await login();
  });

  it("12カ月すべての基本給が揃うと前月までの年収を返す", async () => {
    // 当月の前月から遡って広めに単価を 80万 で埋める（各四半期の前提を揃える）。
    const items = Array.from({ length: 24 }, (_v, i) => ({
      yearMonth: addMonths(baseYm, -(i + 1)),
      unitPrice: 800_000,
    }));
    const res = await postJson("/api/prices/bulk", { items }, cookie);
    expect(res.status).toBe(201);

    const body = await dashboard(cookie);
    expect(body.annualIncome).not.toBeNull();
    const a = body.annualIncome!;
    expect(a.months).toHaveLength(12);
    expect(a.startMonth).toBe(addMonths(baseYm, -12));
    expect(a.endMonth).toBe(addMonths(baseYm, -1));
    // 80万・G帯ランク1 → 基本給 425,840（手当・残業なし）。
    expect(a.totalBaseSalary).toBe(425_840 * 12);
    expect(a.total).toBe(425_840 * 12);
  });

  it("データが揃わなければ null（カード非表示）", async () => {
    const body = await dashboard(cookie);
    expect(body.annualIncome).toBeNull();
  });
});
