/**
 * 認証済み API（/api/*）。
 * すべて「ログイン中の本人のデータ」だけを参照・編集する。
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
import type { PricePoint, SalaryStatus } from "@shared/calc";
import type { Rank } from "@shared/rateTable";
import {
  buildMonthlyIncome,
  isEmploymentTypeKey,
  DEFAULT_USER_SETTINGS,
  type AllowanceEntry,
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
  AllowanceHistoryRow,
  MonthlyOvertimeRow,
  MonthlyPriceRow,
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

// --- 内部: ユーザーの月単価とランク履歴を取得 ---
async function loadUserData(env: Env, userId: string) {
  const db = getDb(env.DB);
  const [prices, ranks] = await Promise.all([
    db
      .select()
      .from(schema.monthlyPrices)
      .where(eq(schema.monthlyPrices.userId, userId))
      .all(),
    db
      .select()
      .from(schema.rankHistory)
      .where(eq(schema.rankHistory.userId, userId))
      .all(),
  ]);

  const priceDTOs: MonthlyPriceDTO[] = prices
    .map((p) => ({ id: p.id, yearMonth: p.yearMonth, unitPrice: p.unitPrice }))
    .sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));

  const rankDTOs: RankHistoryDTO[] = ranks
    .map((r) => ({
      id: r.id,
      effectiveFrom: r.effectiveFrom,
      rank: r.rank as Rank,
    }))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));

  return { priceDTOs, rankDTOs };
}

function toAllowanceDTO(r: AllowanceHistoryRow): AllowanceDTO {
  return {
    id: r.id,
    name: r.name,
    effectiveFrom: r.effectiveFrom,
    amount: r.amount,
    includeInOvertimeBase: r.includeInOvertimeBase === 1,
  };
}

function toOvertimeDTO(r: MonthlyOvertimeRow): MonthlyOvertimeDTO {
  return {
    id: r.id,
    yearMonth: r.yearMonth,
    normalHours: r.normalHours,
    nightHours: r.nightHours,
    holidayHours: r.holidayHours,
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
  };
}

/** 月収算出用の追加データ（手当・残業・設定）を取得する。 */
async function loadIncomeData(env: Env, userId: string) {
  const db = getDb(env.DB);
  const [allowances, overtime, settingsRow] = await Promise.all([
    db
      .select()
      .from(schema.allowanceHistory)
      .where(eq(schema.allowanceHistory.userId, userId))
      .all(),
    db
      .select()
      .from(schema.monthlyOvertime)
      .where(eq(schema.monthlyOvertime.userId, userId))
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
      a.effectiveFrom < b.effectiveFrom
        ? -1
        : a.effectiveFrom > b.effectiveFrom
          ? 1
          : a.name < b.name
            ? -1
            : 1,
    );
  const overtimeDTOs: MonthlyOvertimeDTO[] = overtime
    .map(toOvertimeDTO)
    .sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));
  const settings = toSettingsDTO(settingsRow);

  return { allowanceDTOs, overtimeDTOs, settings };
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
 *
 * 単価/ランクの保存後に呼ぶ。**最新の来期だけでなく、算出できる全四半期**を対象に
 * 同一 applied_from を最新値で更新（無ければ作成）する。これにより、月を個別に
 * 入力した場合と一括で入力した場合とで、永続化される監査スナップショットが
 * 一致する（入力順・入力単位に依存しない）。
 * 算出可能な四半期が無い場合は何もしない。upsert は D1 の batch で原子的に適用する。
 */
async function reconcileSnapshots(env: Env, userId: string): Promise<void> {
  const { priceDTOs, rankDTOs } = await loadUserData(env, userId);
  const pricePoints: PricePoint[] = priceDTOs.map((p) => ({
    yearMonth: p.yearMonth,
    unitPrice: p.unitPrice,
  }));
  const rankHistory: RankHistoryEntry[] = rankDTOs.map((r) => ({
    effectiveFrom: r.effectiveFrom,
    rank: r.rank,
  }));

  const snaps = buildAllPeriodSnapshots(pricePoints, rankHistory);
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
  const [{ priceDTOs, rankDTOs }, savedResults, incomeData] = await Promise.all([
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

  // 今期: 現在の四半期に適用される給与（直前四半期の平均単価が基準）
  const current = computeSalaryForQuarter(currentQuarter, priceMap, rankHistory);

  // 来期: 次の四半期に適用される給与（今四半期の平均単価が基準）
  const nextQuarter = nextQuarterStart(currentQuarter);
  let next = null;
  let nextPending: string | null = null;
  if (priceDTOs.length === 0) {
    nextPending =
      "月単価がまだ登録されていません。まずは1四半期（3ヶ月）分の単価を入力してください。";
  } else {
    next = computeSalaryForQuarter(nextQuarter, priceMap, rankHistory);
    if (!next) {
      nextPending = `来期（${quarterLabel(nextQuarter)}）の予測には、今四半期（${quarterLabel(
        currentQuarter,
      )}）の月単価3ヶ月分が必要です。`;
    }
  }

  const history = buildSalaryHistory(pricePoints, rankHistory);

  // 当月の月収内訳（基本給 + 手当 + 残業）。基本給は今期の四半期給与を当月分として使う。
  const settings: UserSettings = incomeData.settings;
  const allowanceHistory: AllowanceEntry[] = incomeData.allowanceDTOs.map(
    (a) => ({
      name: a.name,
      effectiveFrom: a.effectiveFrom,
      amount: a.amount,
      includeInOvertimeBase: a.includeInOvertimeBase,
    }),
  );
  const thisMonthOvertimeDTO = incomeData.overtimeDTOs.find(
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
    allowanceHistory,
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
    overtime: incomeData.overtimeDTOs,
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

// --- POST /api/prices  (作成 or 更新: year_month で upsert) ---
apiApp.post("/api/prices", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const yearMonth = body?.yearMonth;
  const unitPrice = body?.unitPrice;

  if (!isValidYearMonth(yearMonth)) {
    return c.json({ error: "年月の形式が不正です（YYYY-MM）。" }, 400);
  }
  if (
    typeof unitPrice !== "number" ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    unitPrice > 100_000_000
  ) {
    return c.json({ error: "単価は0以上の妥当な金額で入力してください。" }, 400);
  }

  const db = getDb(c.env.DB);
  const existing = await db
    .select()
    .from(schema.monthlyPrices)
    .where(
      and(
        eq(schema.monthlyPrices.userId, userId),
        eq(schema.monthlyPrices.yearMonth, yearMonth),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(schema.monthlyPrices)
      .set({ unitPrice: Math.round(unitPrice), updatedAt: Date.now() })
      .where(eq(schema.monthlyPrices.id, existing.id))
      .run();
    // 来期の確定スナップショットを保存（PRD §9）
    await reconcileSnapshots(c.env, userId);
    return c.json({
      price: { id: existing.id, yearMonth, unitPrice: Math.round(unitPrice) },
    });
  }

  const row = {
    id: newId(),
    userId,
    yearMonth,
    unitPrice: Math.round(unitPrice),
    updatedAt: Date.now(),
  };
  await db.insert(schema.monthlyPrices).values(row).run();
  // 来期の確定スナップショットを保存（PRD §9）
  await reconcileSnapshots(c.env, userId);
  return c.json(
    { price: { id: row.id, yearMonth, unitPrice: row.unitPrice } },
    201,
  );
});

// --- POST /api/prices/bulk  (複数月をまとめて作成 or 更新) ---
// 連続する月に同じ単価をまとめて入力する用途（例: 4〜6月を一括で 80万円）。
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

  // 全件バリデーション（1件でも不正なら何も保存しない）。
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
    if (
      typeof unitPrice !== "number" ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      unitPrice > 100_000_000
    ) {
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
  // 途中失敗時に一部だけ適用されることを防ぎ、文書化された「原子的な一括 upsert」を満たす。
  // 既存月との競合は unique index (user_id, year_month) で検知し、その行を更新する
  // （事前 select に依存しないため、同時実行で間に挿入されても破綻しない）。
  const upserts = normalized.map(({ yearMonth, unitPrice }) =>
    db
      .insert(schema.monthlyPrices)
      .values({ id: newId(), userId, yearMonth, unitPrice, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.monthlyPrices.userId, schema.monthlyPrices.yearMonth],
        set: { unitPrice, updatedAt: now },
      })
      .returning(),
  );
  const results = await db.batch([upserts[0], ...upserts.slice(1)]);
  const saved: MonthlyPriceDTO[] = (results as MonthlyPriceRow[][]).map(
    (rows) => {
      const r = rows[0];
      return { id: r.id, yearMonth: r.yearMonth, unitPrice: r.unitPrice };
    },
  );

  // 算出可能な全四半期の確定スナップショットを保存（PRD §9）。
  await reconcileSnapshots(c.env, userId);
  saved.sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1));
  return c.json({ prices: saved }, 201);
});

// --- DELETE /api/prices/:id ---
apiApp.delete("/api/prices/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  await db
    .delete(schema.monthlyPrices)
    .where(
      and(
        eq(schema.monthlyPrices.id, id),
        eq(schema.monthlyPrices.userId, userId),
      ),
    )
    .run();
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
    // 来期の確定スナップショットを保存（PRD §9）
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
  // 来期の確定スナップショットを保存（PRD §9）
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
      and(
        eq(schema.rankHistory.id, id),
        eq(schema.rankHistory.userId, userId),
      ),
    )
    .run();
  return c.json({ ok: true });
});

// --- POST /api/allowances  (特別手当の設定: name × effective_from で upsert) ---
apiApp.post("/api/allowances", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const effectiveFrom = body?.effectiveFrom ?? currentYearMonth();
  const amount = body?.amount;
  const includeInOvertimeBase = body?.includeInOvertimeBase === true;

  if (!name) {
    return c.json({ error: "手当名を入力してください。" }, 400);
  }
  if (name.length > 50) {
    return c.json({ error: "手当名は50文字以内で入力してください。" }, 400);
  }
  if (!isValidYearMonth(effectiveFrom)) {
    return c.json({ error: "適用開始月の形式が不正です（YYYY-MM）。" }, 400);
  }
  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 100_000_000
  ) {
    return c.json({ error: "手当額は0以上の妥当な金額で入力してください。" }, 400);
  }

  const db = getDb(c.env.DB);
  const includeFlag = includeInOvertimeBase ? 1 : 0;
  const existing = await db
    .select()
    .from(schema.allowanceHistory)
    .where(
      and(
        eq(schema.allowanceHistory.userId, userId),
        eq(schema.allowanceHistory.name, name),
        eq(schema.allowanceHistory.effectiveFrom, effectiveFrom),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(schema.allowanceHistory)
      .set({
        amount: Math.round(amount),
        includeInOvertimeBase: includeFlag,
        updatedAt: Date.now(),
      })
      .where(eq(schema.allowanceHistory.id, existing.id))
      .run();
    return c.json({ allowance: toAllowanceDTO({ ...existing, amount: Math.round(amount), includeInOvertimeBase: includeFlag }) });
  }

  const row = {
    id: newId(),
    userId,
    name,
    effectiveFrom,
    amount: Math.round(amount),
    includeInOvertimeBase: includeFlag,
    updatedAt: Date.now(),
  };
  await db.insert(schema.allowanceHistory).values(row).run();
  return c.json({ allowance: toAllowanceDTO(row) }, 201);
});

// --- DELETE /api/allowances/:id ---
apiApp.delete("/api/allowances/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  await db
    .delete(schema.allowanceHistory)
    .where(
      and(
        eq(schema.allowanceHistory.id, id),
        eq(schema.allowanceHistory.userId, userId),
      ),
    )
    .run();
  return c.json({ ok: true });
});

/** 残業時間（0以上の妥当な数値）か検証する。h 上限は安全のため 744（月の総時間）。 */
function isValidHours(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 744;
}

// --- POST /api/overtime  (月次残業時間: year_month で upsert) ---
apiApp.post("/api/overtime", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const yearMonth = body?.yearMonth;
  const normalHours = body?.normalHours ?? 0;
  const nightHours = body?.nightHours ?? 0;
  const holidayHours = body?.holidayHours ?? 0;

  if (!isValidYearMonth(yearMonth)) {
    return c.json({ error: "年月の形式が不正です（YYYY-MM）。" }, 400);
  }
  if (
    !isValidHours(normalHours) ||
    !isValidHours(nightHours) ||
    !isValidHours(holidayHours)
  ) {
    return c.json({ error: "残業時間は0以上の妥当な時間で入力してください。" }, 400);
  }

  const db = getDb(c.env.DB);
  const now = Date.now();
  const existing = await db
    .select()
    .from(schema.monthlyOvertime)
    .where(
      and(
        eq(schema.monthlyOvertime.userId, userId),
        eq(schema.monthlyOvertime.yearMonth, yearMonth),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(schema.monthlyOvertime)
      .set({ normalHours, nightHours, holidayHours, updatedAt: now })
      .where(eq(schema.monthlyOvertime.id, existing.id))
      .run();
    return c.json({
      overtime: toOvertimeDTO({
        ...existing,
        normalHours,
        nightHours,
        holidayHours,
      }),
    });
  }

  const row = {
    id: newId(),
    userId,
    yearMonth,
    normalHours,
    nightHours,
    holidayHours,
    updatedAt: now,
  };
  await db.insert(schema.monthlyOvertime).values(row).run();
  return c.json({ overtime: toOvertimeDTO(row) }, 201);
});

// --- DELETE /api/overtime/:id ---
apiApp.delete("/api/overtime/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  await db
    .delete(schema.monthlyOvertime)
    .where(
      and(
        eq(schema.monthlyOvertime.id, id),
        eq(schema.monthlyOvertime.userId, userId),
      ),
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

  const db = getDb(c.env.DB);
  const now = Date.now();
  await db
    .insert(schema.userSettings)
    .values({
      userId,
      employmentType,
      monthlyStandardHours,
      deemedOvertimeHours,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.userSettings.userId,
      set: { employmentType, monthlyStandardHours, deemedOvertimeHours, updatedAt: now },
    })
    .run();

  return c.json({
    settings: {
      employmentType,
      monthlyStandardHours,
      deemedOvertimeHours,
    } satisfies UserSettingsDTO,
  });
});

// --- DELETE /api/user/data  (ログイン中ユーザーの全データを削除。users 行は残す) ---
apiApp.delete("/api/user/data", async (c) => {
  const userId = c.get("userId");
  const db = getDb(c.env.DB);
  await db.batch([
    db
      .delete(schema.monthlyPrices)
      .where(eq(schema.monthlyPrices.userId, userId)),
    db.delete(schema.rankHistory).where(eq(schema.rankHistory.userId, userId)),
    db
      .delete(schema.salaryResults)
      .where(eq(schema.salaryResults.userId, userId)),
    db
      .delete(schema.allowanceHistory)
      .where(eq(schema.allowanceHistory.userId, userId)),
    db
      .delete(schema.monthlyOvertime)
      .where(eq(schema.monthlyOvertime.userId, userId)),
    db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId)),
  ]);
  return c.json({ ok: true });
});
