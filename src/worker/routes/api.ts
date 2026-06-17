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
import { isValidYearMonth } from "@shared/periods";
import {
  buildSalaryHistory,
  buildNextPeriodSnapshot,
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
import type {
  DashboardResponse,
  MeResponse,
  MonthlyPriceDTO,
  RankHistoryDTO,
  SalaryResultDTO,
} from "@shared/types";
import type { SalaryResultRow } from "../db/schema";

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
 * 来期（最新単価の翌月適用）の確定スナップショットを `salary_results` に upsert する。
 * 単価/ランクの保存後に呼び、同一 applied_from は最新値で更新する（PRD §9）。
 * 算出に必要な直前3ヶ月が揃っていない場合は何もしない。
 */
async function snapshotNextPeriod(env: Env, userId: string): Promise<void> {
  const { priceDTOs, rankDTOs } = await loadUserData(env, userId);
  const pricePoints: PricePoint[] = priceDTOs.map((p) => ({
    yearMonth: p.yearMonth,
    unitPrice: p.unitPrice,
  }));
  const rankHistory: RankHistoryEntry[] = rankDTOs.map((r) => ({
    effectiveFrom: r.effectiveFrom,
    rank: r.rank,
  }));

  const snap = buildNextPeriodSnapshot(pricePoints, rankHistory);
  if (!snap) return;

  const db = getDb(env.DB);
  const now = Date.now();
  const existing = await db
    .select()
    .from(schema.salaryResults)
    .where(
      and(
        eq(schema.salaryResults.userId, userId),
        eq(schema.salaryResults.appliedFrom, snap.appliedFrom),
      ),
    )
    .get();

  if (existing) {
    await db
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
      .where(eq(schema.salaryResults.id, existing.id))
      .run();
    return;
  }

  await db
    .insert(schema.salaryResults)
    .values({
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
    })
    .run();
}

// --- GET /api/dashboard ---
apiApp.get("/api/dashboard", async (c) => {
  const userId = c.get("userId");
  const [{ priceDTOs, rankDTOs }, savedResults] = await Promise.all([
    loadUserData(c.env, userId),
    loadSavedResults(c.env, userId),
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
    await snapshotNextPeriod(c.env, userId);
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
  await snapshotNextPeriod(c.env, userId);
  return c.json(
    { price: { id: row.id, yearMonth, unitPrice: row.unitPrice } },
    201,
  );
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
    await snapshotNextPeriod(c.env, userId);
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
  await snapshotNextPeriod(c.env, userId);
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
