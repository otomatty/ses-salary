/**
 * 認証済み API（/api/*）。
 * すべて「ログイン中の本人のデータ」だけを参照・編集する。
 *
 * 月別入力の再設計後の中心エンドポイントは `/api/months/:yearMonth`（単価・残業・手当を
 * その月分まとめて upsert）。オンボーディングの単価一括入力のため `/api/prices` 系も残す。
 */

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { Env } from "../env";
import { getDb, schema } from "../db";
import { newId } from "../lib/id";
import { getUserIdFromRequest } from "../auth";
import { isValidYearMonth, BULK_MAX_MONTHS } from "@shared/periods";
import {
  buildSalaryHistory,
  buildAllPeriodSnapshots,
  computeSalaryForQuarter,
  currentYearMonth,
  quarterStartMonth,
  nextQuarterStart,
  quarterLabel,
  rankAt,
  isRankProvisional,
  type RankHistoryEntry,
} from "@shared/periods";
import { findAllowanceDefinition } from "@shared/allowanceMaster";
import type { PricePoint, SalaryStatus } from "@shared/calc";
import type { Rank } from "@shared/rateTable";
import {
  isValidUnitPrice,
  resolveMonthUpsert,
} from "./monthInput";
import {
  buildMonthlyIncome,
  isEmploymentTypeKey,
  DEFAULT_USER_SETTINGS,
  type MonthlyAllowanceItem,
  type OvertimeHours,
  type UserSettings,
} from "@shared/income";
import type {
  AllowanceDTO,
  DashboardResponse,
  MeResponse,
  MonthlyOvertimeDTO,
  MonthlyPriceDTO,
  RankHistoryDTO,
  SalaryResultDTO,
  UserSettingsDTO,
} from "@shared/types";
import type {
  MonthlyAllowanceRow,
  MonthlyEntryRow,
  SalaryResultRow,
  UserSettingsRow,
} from "../db/schema";

type AppEnv = { Bindings: Env; Variables: { userId: string } };

export const apiApp = new Hono<AppEnv>();

// --- 認証ミドルウェア: /api/me 以外はログイン必須 ---
apiApp.use("/api/*", async (c, next) => {
  const userId = await getUserIdFromRequest(c, c.env);
  if (c.req.path === "/api/me") {
    if (userId) c.set("userId", userId);
    return next();
  }
  if (!userId) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", userId);
  return next();
});

function isRank(v: unknown): v is Rank {
  return v === 1 || v === 2 || v === 3;
}

// --- GET /api/me ---
apiApp.get("/api/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json<MeResponse>({ user: null });
  const db = getDb(c.env.DB);
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  if (!user) return c.json<MeResponse>({ user: null });
  return c.json<MeResponse>({
    user: { id: user.id, name: user.name, email: user.email },
  });
});

function toPriceDTO(r: MonthlyEntryRow): MonthlyPriceDTO {
  return { id: r.id, yearMonth: r.yearMonth, unitPrice: r.unitPrice };
}

function toOvertimeDTO(r: MonthlyEntryRow): MonthlyOvertimeDTO {
  return {
    id: r.id,
    yearMonth: r.yearMonth,
    normalHours: r.overtimeNormalHours,
    nightHours: r.overtimeNightHours,
    holidayHours: r.overtimeHolidayHours,
  };
}

function toAllowanceDTO(r: MonthlyAllowanceRow): AllowanceDTO {
  const def = findAllowanceDefinition(r.name);
  return {
    id: r.id,
    yearMonth: r.yearMonth,
    name: r.name,
    amount: r.amount,
    includeInOvertimeBase:
      def?.includeInOvertimeBase ?? r.includeInOvertimeBase === 1,
  };
}

function toSettingsDTO(r: UserSettingsRow | undefined): UserSettingsDTO {
  if (!r) return { ...DEFAULT_USER_SETTINGS };
  return {
    employmentType: isEmploymentTypeKey(r.employmentType)
      ? r.employmentType
      : DEFAULT_USER_SETTINGS.employmentType,
    monthlyStandardHours: r.monthlyStandardHours,
    deemedOvertimeHours: r.deemedOvertimeHours,
    consultRate: r.consultRate,
  };
}

/** ユーザーの月別入力（単価＋残業）とランク履歴を取得する。 */
async function loadUserData(env: Env, userId: string) {
  const db = getDb(env.DB);
  const [entries, ranks] = await Promise.all([
    db
      .select()
      .from(schema.monthlyEntries)
      .where(eq(schema.monthlyEntries.userId, userId))
      .all(),
    db
      .select()
      .from(schema.rankHistory)
      .where(eq(schema.rankHistory.userId, userId))
      .all(),
  ]);

  // 単価 0 は手当・残業のみのプレースホルダ行。月単価一覧には含めない。
  const priceDTOs: MonthlyPriceDTO[] = entries
    .filter((e) => e.unitPrice > 0)
    .map(toPriceDTO)
    .sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));
  const overtimeDTOs: MonthlyOvertimeDTO[] = entries
    .map(toOvertimeDTO)
    .sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));

  const rankDTOs: RankHistoryDTO[] = ranks
    .map((r) => ({
      id: r.id,
      effectiveFrom: r.effectiveFrom,
      rank: r.rank as Rank,
    }))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));

  return { priceDTOs, overtimeDTOs, rankDTOs };
}

/** 月収算出用の追加データ（月別手当・設定）を取得する。 */
async function loadIncomeData(env: Env, userId: string) {
  const db = getDb(env.DB);
  const [allowances, settingsRow] = await Promise.all([
    db
      .select()
      .from(schema.monthlyAllowances)
      .where(eq(schema.monthlyAllowances.userId, userId))
      .all(),
    db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .get(),
  ]);

  const allowanceDTOs: AllowanceDTO[] = allowances
    .map(toAllowanceDTO)
    .sort((a, b) =>
      a.yearMonth < b.yearMonth
        ? -1
        : a.yearMonth > b.yearMonth
          ? 1
          : a.name < b.name
            ? -1
            : 1,
    );
  const settings = toSettingsDTO(settingsRow);

  return { allowanceDTOs, settings };
}

function toResultDTO(r: SalaryResultRow): SalaryResultDTO {
  return {
    id: r.id,
    appliedFrom: r.appliedFrom,
    avgUnitPrice: r.avgUnitPrice,
    appliedBand: r.appliedBand,
    appliedRank: r.appliedRank as Rank,
    appliedRate: r.appliedRate,
    salary: r.salary,
    status: r.status as SalaryStatus,
    calculatedAt: r.calculatedAt,
  };
}

/** 保存済みスナップショットを古い順で取得する。 */
async function loadSavedResults(
  env: Env,
  userId: string,
): Promise<SalaryResultDTO[]> {
  const db = getDb(env.DB);
  const rows = await db
    .select()
    .from(schema.salaryResults)
    .where(eq(schema.salaryResults.userId, userId))
    .all();
  return rows
    .map(toResultDTO)
    .sort((a, b) => (a.appliedFrom < b.appliedFrom ? -1 : 1));
}

/**
 * 算出可能な全四半期の確定スナップショットを `salary_results` に upsert する（PRD §9）。
 * 単価/ランクの保存後に呼ぶ。算出可能な四半期が無い場合は何もしない。
 */
async function reconcileSnapshots(env: Env, userId: string): Promise<void> {
  const [{ priceDTOs, rankDTOs }, { settings }] = await Promise.all([
    loadUserData(env, userId),
    loadIncomeData(env, userId),
  ]);
  const pricePoints: PricePoint[] = priceDTOs.map((p) => ({
    yearMonth: p.yearMonth,
    unitPrice: p.unitPrice,
  }));
  const rankHistory: RankHistoryEntry[] = rankDTOs.map((r) => ({
    effectiveFrom: r.effectiveFrom,
    rank: r.rank,
  }));

  const snaps = buildAllPeriodSnapshots(
    pricePoints,
    rankHistory,
    1,
    settings.consultRate,
  );
  if (snaps.length === 0) return;

  const db = getDb(env.DB);
  const now = Date.now();
  const existing = await db
    .select()
    .from(schema.salaryResults)
    .where(eq(schema.salaryResults.userId, userId))
    .all();
  const byApplied = new Map(existing.map((r) => [r.appliedFrom, r]));

  const stmts = snaps.map((snap) => {
    const hit = byApplied.get(snap.appliedFrom);
    if (hit) {
      return db
        .update(schema.salaryResults)
        .set({
          avgUnitPrice: snap.avgUnitPrice,
          appliedBand: snap.appliedBand,
          appliedRank: snap.appliedRank,
          appliedRate: snap.appliedRate,
          salary: snap.salary,
          status: snap.status,
          calculatedAt: now,
        })
        .where(eq(schema.salaryResults.id, hit.id));
    }
    return db.insert(schema.salaryResults).values({
      id: newId(),
      userId,
      appliedFrom: snap.appliedFrom,
      avgUnitPrice: snap.avgUnitPrice,
      appliedBand: snap.appliedBand,
      appliedRank: snap.appliedRank,
      appliedRate: snap.appliedRate,
      salary: snap.salary,
      status: snap.status,
      calculatedAt: now,
    });
  });

  await db.batch([stmts[0], ...stmts.slice(1)]);
}

// --- GET /api/dashboard ---
apiApp.get("/api/dashboard", async (c) => {
  const userId = c.get("userId");
  const [{ priceDTOs, overtimeDTOs, rankDTOs }, savedResults, incomeData] =
    await Promise.all([
      loadUserData(c.env, userId),
      loadSavedResults(c.env, userId),
      loadIncomeData(c.env, userId),
    ]);

  const rankHistory: RankHistoryEntry[] = rankDTOs.map((r) => ({
    effectiveFrom: r.effectiveFrom,
    rank: r.rank,
  }));
  const priceMap = new Map(priceDTOs.map((p) => [p.yearMonth, p.unitPrice]));
  const pricePoints = priceDTOs.map((p) => ({
    yearMonth: p.yearMonth,
    unitPrice: p.unitPrice,
  }));

  const thisMonth = currentYearMonth();
  const currentQuarter = quarterStartMonth(thisMonth);
  const currentRank = rankAt(rankHistory, thisMonth);
  const rankProvisional = isRankProvisional(rankHistory, thisMonth);
  const consultRate = incomeData.settings.consultRate;

  // 今期: 現在の四半期に適用される給与（直前四半期の平均単価が基準）
  const current = computeSalaryForQuarter(
    currentQuarter,
    priceMap,
    rankHistory,
    1,
    consultRate,
  );

  // 来期: 次の四半期に適用される給与（今四半期の平均単価が基準）
  const nextQuarter = nextQuarterStart(currentQuarter);
  let next = null;
  let nextPending: string | null = null;
  if (priceDTOs.length === 0) {
    nextPending =
      "月単価がまだ登録されていません。まずは1四半期（3ヶ月）分の単価を入力してください。";
  } else {
    next = computeSalaryForQuarter(
      nextQuarter,
      priceMap,
      rankHistory,
      1,
      consultRate,
    );
    if (!next) {
      nextPending = `来期（${quarterLabel(nextQuarter)}）の予測には、今四半期（${quarterLabel(
        currentQuarter,
      )}）の月単価3ヶ月分が必要です。`;
    }
  }

  const history = buildSalaryHistory(pricePoints, rankHistory, 1, consultRate);

  // 当月の月収内訳（基本給 + 手当 + 残業）。基本給は今期の四半期給与を当月分として使う。
  const settings: UserSettings = incomeData.settings;
  const thisMonthAllowances: MonthlyAllowanceItem[] = incomeData.allowanceDTOs
    .filter((a) => a.yearMonth === thisMonth)
    .map((a) => ({
      name: a.name,
      amount: a.amount,
      includeInOvertimeBase: a.includeInOvertimeBase,
    }));
  const thisMonthOvertimeDTO = overtimeDTOs.find(
    (o) => o.yearMonth === thisMonth,
  );
  const thisMonthOvertime: OvertimeHours | null = thisMonthOvertimeDTO
    ? {
        normalHours: thisMonthOvertimeDTO.normalHours,
        nightHours: thisMonthOvertimeDTO.nightHours,
        holidayHours: thisMonthOvertimeDTO.holidayHours,
      }
    : null;
  const currentMonthIncome = buildMonthlyIncome({
    yearMonth: thisMonth,
    baseSalary: current?.breakdown.salary ?? null,
    settings,
    allowances: thisMonthAllowances,
    overtime: thisMonthOvertime,
  });

  return c.json<DashboardResponse>({
    prices: priceDTOs,
    rankHistory: rankDTOs,
    currentRank,
    rankProvisional,
    current,
    next,
    history,
    savedResults,
    nextPending,
    allowances: incomeData.allowanceDTOs,
    overtime: overtimeDTOs,
    settings: incomeData.settings,
    currentMonthIncome,
  });
});

// --- GET /api/salary-results  (保存済みスナップショットの履歴) ---
apiApp.get("/api/salary-results", async (c) => {
  const userId = c.get("userId");
  const results = await loadSavedResults(c.env, userId);
  return c.json<{ results: SalaryResultDTO[] }>({ results });
});

// --- GET /api/prices ---
apiApp.get("/api/prices", async (c) => {
  const userId = c.get("userId");
  const { priceDTOs } = await loadUserData(c.env, userId);
  return c.json({ prices: priceDTOs });
});

// --- POST /api/prices  (作成 or 更新: year_month で upsert。単価のみ) ---
apiApp.post("/api/prices", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const yearMonth = body?.yearMonth;
  const unitPrice = body?.unitPrice;

  if (!isValidYearMonth(yearMonth)) {
    return c.json({ error: "年月の形式が不正です（YYYY-MM）。" }, 400);
  }
  if (!isValidUnitPrice(unitPrice)) {
    return c.json({ error: "単価は0以上の妥当な金額で入力してください。" }, 400);
  }

  const db = getDb(c.env.DB);
  const now = Date.now();
  const price = Math.round(unitPrice);
  const existing = await db
    .select()
    .from(schema.monthlyEntries)
    .where(
      and(
        eq(schema.monthlyEntries.userId, userId),
        eq(schema.monthlyEntries.yearMonth, yearMonth),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(schema.monthlyEntries)
      .set({ unitPrice: price, updatedAt: now })
      .where(eq(schema.monthlyEntries.id, existing.id))
      .run();
    await reconcileSnapshots(c.env, userId);
    return c.json({ price: { id: existing.id, yearMonth, unitPrice: price } });
  }

  const row = {
    id: newId(),
    userId,
    yearMonth,
    unitPrice: price,
    overtimeNormalHours: 0,
    overtimeNightHours: 0,
    overtimeHolidayHours: 0,
    updatedAt: now,
  };
  await db.insert(schema.monthlyEntries).values(row).run();
  await reconcileSnapshots(c.env, userId);
  return c.json({ price: { id: row.id, yearMonth, unitPrice: price } }, 201);
});

// --- POST /api/prices/bulk  (複数月の単価をまとめて作成 or 更新) ---
apiApp.post("/api/prices/bulk", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const items: unknown = body?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return c.json({ error: "入力する月単価がありません。" }, 400);
  }
  if (items.length > BULK_MAX_MONTHS) {
    return c.json(
      { error: `一度に入力できるのは${BULK_MAX_MONTHS}ヶ月までです。` },
      400,
    );
  }

  const normalized: { yearMonth: string; unitPrice: number }[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const yearMonth = (item as { yearMonth?: unknown })?.yearMonth;
    const unitPrice = (item as { unitPrice?: unknown })?.unitPrice;
    if (typeof yearMonth !== "string" || !isValidYearMonth(yearMonth)) {
      return c.json({ error: "年月の形式が不正です（YYYY-MM）。" }, 400);
    }
    if (seen.has(yearMonth)) {
      return c.json({ error: `年月が重複しています（${yearMonth}）。` }, 400);
    }
    seen.add(yearMonth);
    if (!isValidUnitPrice(unitPrice)) {
      return c.json(
        { error: "単価は0以上の妥当な金額で入力してください。" },
        400,
      );
    }
    normalized.push({ yearMonth, unitPrice: Math.round(unitPrice) });
  }

  const db = getDb(c.env.DB);
  const now = Date.now();
  // 全件を1つの batch（D1 の暗黙トランザクション）で upsert する。
  const upserts = normalized.map(({ yearMonth, unitPrice }) =>
    db
      .insert(schema.monthlyEntries)
      .values({ id: newId(), userId, yearMonth, unitPrice, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.monthlyEntries.userId, schema.monthlyEntries.yearMonth],
        set: { unitPrice, updatedAt: now },
      })
      .returning(),
  );
  const results = await db.batch([upserts[0], ...upserts.slice(1)]);
  const saved: MonthlyPriceDTO[] = (results as MonthlyEntryRow[][]).map((rows) =>
    toPriceDTO(rows[0]),
  );

  await reconcileSnapshots(c.env, userId);
  saved.sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));
  return c.json({ prices: saved }, 201);
});

// --- POST /api/months/:yearMonth  (その月の単価・残業・手当をまとめて upsert) ---
apiApp.post("/api/months/:yearMonth", async (c) => {
  const userId = c.get("userId");
  const yearMonth = c.req.param("yearMonth");
  const body = await c.req.json().catch(() => null);

  if (!isValidYearMonth(yearMonth)) {
    return c.json({ error: "年月の形式が不正です（YYYY-MM）。" }, 400);
  }

  const db = getDb(c.env.DB);
  const existing = await db
    .select()
    .from(schema.monthlyEntries)
    .where(
      and(
        eq(schema.monthlyEntries.userId, userId),
        eq(schema.monthlyEntries.yearMonth, yearMonth),
      ),
    )
    .get();

  const resolved = resolveMonthUpsert(body, existing);
  if ("error" in resolved) {
    return c.json({ error: resolved.error }, 400);
  }

  const now = Date.now();
  const { unitPrice, overtime, replaceAllowances, allowances } = resolved;

  const entryUpsert = db
    .insert(schema.monthlyEntries)
    .values({
      id: newId(),
      userId,
      yearMonth,
      unitPrice,
      overtimeNormalHours: overtime.normalHours,
      overtimeNightHours: overtime.nightHours,
      overtimeHolidayHours: overtime.holidayHours,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.monthlyEntries.userId, schema.monthlyEntries.yearMonth],
      set: {
        unitPrice,
        overtimeNormalHours: overtime.normalHours,
        overtimeNightHours: overtime.nightHours,
        overtimeHolidayHours: overtime.holidayHours,
        updatedAt: now,
      },
    });

  if (replaceAllowances) {
    await db.batch([
      entryUpsert,
      db
        .delete(schema.monthlyAllowances)
        .where(
          and(
            eq(schema.monthlyAllowances.userId, userId),
            eq(schema.monthlyAllowances.yearMonth, yearMonth),
          ),
        ),
      ...allowances.map((a) =>
        db.insert(schema.monthlyAllowances).values({
          id: newId(),
          userId,
          yearMonth,
          name: a.name,
          amount: a.amount,
          includeInOvertimeBase: a.includeInOvertimeBase ? 1 : 0,
          updatedAt: now,
        }),
      ),
    ]);
  } else {
    await db.batch([entryUpsert]);
  }
  await reconcileSnapshots(c.env, userId);
  return c.json({ ok: true });
});

// --- DELETE /api/months/:yearMonth  (その月の入力と手当をすべて削除) ---
apiApp.delete("/api/months/:yearMonth", async (c) => {
  const userId = c.get("userId");
  const yearMonth = c.req.param("yearMonth");
  if (!isValidYearMonth(yearMonth)) {
    return c.json({ error: "年月の形式が不正です（YYYY-MM）。" }, 400);
  }
  const db = getDb(c.env.DB);
  await db.batch([
    db
      .delete(schema.monthlyEntries)
      .where(
        and(
          eq(schema.monthlyEntries.userId, userId),
          eq(schema.monthlyEntries.yearMonth, yearMonth),
        ),
      ),
    db
      .delete(schema.monthlyAllowances)
      .where(
        and(
          eq(schema.monthlyAllowances.userId, userId),
          eq(schema.monthlyAllowances.yearMonth, yearMonth),
        ),
      ),
  ]);
  await reconcileSnapshots(c.env, userId);
  return c.json({ ok: true });
});

// --- POST /api/rank  (評価ランクの設定: effective_from で upsert) ---
apiApp.post("/api/rank", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const rank = body?.rank;
  // 適用開始月。未指定なら当月から。
  const effectiveFrom = body?.effectiveFrom ?? currentYearMonth();

  if (!isRank(rank)) {
    return c.json({ error: "評価ランクは 1 / 2 / 3 のいずれかです。" }, 400);
  }
  if (!isValidYearMonth(effectiveFrom)) {
    return c.json({ error: "適用開始月の形式が不正です（YYYY-MM）。" }, 400);
  }

  const db = getDb(c.env.DB);
  const existing = await db
    .select()
    .from(schema.rankHistory)
    .where(
      and(
        eq(schema.rankHistory.userId, userId),
        eq(schema.rankHistory.effectiveFrom, effectiveFrom),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(schema.rankHistory)
      .set({ rank, updatedAt: Date.now() })
      .where(eq(schema.rankHistory.id, existing.id))
      .run();
    await reconcileSnapshots(c.env, userId);
    return c.json({ rank: { id: existing.id, effectiveFrom, rank } });
  }

  const row = {
    id: newId(),
    userId,
    effectiveFrom,
    rank,
    updatedAt: Date.now(),
  };
  await db.insert(schema.rankHistory).values(row).run();
  await reconcileSnapshots(c.env, userId);
  return c.json({ rank: { id: row.id, effectiveFrom, rank } }, 201);
});

// --- DELETE /api/rank/:id ---
apiApp.delete("/api/rank/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  await db
    .delete(schema.rankHistory)
    .where(
      and(eq(schema.rankHistory.id, id), eq(schema.rankHistory.userId, userId)),
    )
    .run();
  return c.json({ ok: true });
});

// --- POST /api/settings  (雇用形態・月平均所定労働時間: ユーザーごとに upsert) ---
apiApp.post("/api/settings", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const employmentType = body?.employmentType;
  const monthlyStandardHours = body?.monthlyStandardHours;
  const deemedOvertimeHours = body?.deemedOvertimeHours ?? null;
  const consultRate = body?.consultRate ?? null;

  if (!isEmploymentTypeKey(employmentType)) {
    return c.json({ error: "雇用形態の指定が不正です。" }, 400);
  }
  if (
    typeof monthlyStandardHours !== "number" ||
    !Number.isFinite(monthlyStandardHours) ||
    monthlyStandardHours <= 0 ||
    monthlyStandardHours > 744
  ) {
    return c.json(
      { error: "月平均所定労働時間は0より大きい妥当な時間で入力してください。" },
      400,
    );
  }
  if (
    deemedOvertimeHours !== null &&
    (typeof deemedOvertimeHours !== "number" ||
      !Number.isFinite(deemedOvertimeHours) ||
      deemedOvertimeHours < 0 ||
      deemedOvertimeHours > 744)
  ) {
    return c.json(
      { error: "みなし残業時間は0以上の妥当な時間で入力してください。" },
      400,
    );
  }
  if (
    consultRate !== null &&
    (typeof consultRate !== "number" ||
      !Number.isFinite(consultRate) ||
      consultRate < 0 ||
      consultRate > 100)
  ) {
    return c.json(
      { error: "M帯の還元率は0〜100の妥当な数値で入力してください。" },
      400,
    );
  }

  const db = getDb(c.env.DB);
  const now = Date.now();
  await db
    .insert(schema.userSettings)
    .values({
      userId,
      employmentType,
      monthlyStandardHours,
      deemedOvertimeHours,
      consultRate,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.userSettings.userId,
      set: {
        employmentType,
        monthlyStandardHours,
        deemedOvertimeHours,
        consultRate,
        updatedAt: now,
      },
    })
    .run();

  // 還元率(consultRate)の変更で給与額が変わり得るため、保存済みスナップショットを再計算する。
  await reconcileSnapshots(c.env, userId);

  return c.json({
    settings: {
      employmentType,
      monthlyStandardHours,
      deemedOvertimeHours,
      consultRate,
    } satisfies UserSettingsDTO,
  });
});

// --- DELETE /api/user/data  (ログイン中ユーザーの全データを削除。users 行は残す) ---
apiApp.delete("/api/user/data", async (c) => {
  const userId = c.get("userId");
  const db = getDb(c.env.DB);
  await db.batch([
    db
      .delete(schema.monthlyEntries)
      .where(eq(schema.monthlyEntries.userId, userId)),
    db.delete(schema.rankHistory).where(eq(schema.rankHistory.userId, userId)),
    db
      .delete(schema.salaryResults)
      .where(eq(schema.salaryResults.userId, userId)),
    db
      .delete(schema.monthlyAllowances)
      .where(eq(schema.monthlyAllowances.userId, userId)),
    db
      .delete(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId)),
  ]);
  return c.json({ ok: true });
});
