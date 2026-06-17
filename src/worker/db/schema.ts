import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/** ユーザー（エンジニア本人） */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at").notNull(), // unix ms
});

/** 月単価（年月ごとに1件） */
export const monthlyPrices = sqliteTable(
  "monthly_prices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(), // "YYYY-MM"
    unitPrice: integer("unit_price").notNull(), // 円
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    userMonthUnique: uniqueIndex("monthly_prices_user_month_unique").on(
      t.userId,
      t.yearMonth,
    ),
  }),
);

/** 評価ランク履歴（適用開始年月ごと） */
export const rankHistory = sqliteTable(
  "rank_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    effectiveFrom: text("effective_from").notNull(), // "YYYY-MM"
    rank: integer("rank").notNull(), // 1 / 2 / 3
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    userEffectiveUnique: uniqueIndex("rank_history_user_effective_unique").on(
      t.userId,
      t.effectiveFrom,
    ),
  }),
);

/**
 * 給与計算結果のスナップショット（PRD §9）。
 * MVP では表示はオンザフライ計算で行うが、監査・追跡用に
 * 来期再計算時のスナップショットを保存できるよう用意している。
 */
export const salaryResults = sqliteTable(
  "salary_results",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appliedFrom: text("applied_from").notNull(), // "YYYY-MM"
    avgUnitPrice: integer("avg_unit_price").notNull(),
    appliedBand: text("applied_band").notNull(),
    appliedRank: integer("applied_rank").notNull(),
    appliedRate: real("applied_rate"), // 要相談/固定は null
    salary: integer("salary"), // 要相談は null
    status: text("status").notNull(), // ok / fixed / consult
    calculatedAt: integer("calculated_at").notNull(),
  },
  (t) => ({
    userAppliedIdx: index("salary_results_user_applied_idx").on(
      t.userId,
      t.appliedFrom,
    ),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type MonthlyPriceRow = typeof monthlyPrices.$inferSelect;
export type RankHistoryRow = typeof rankHistory.$inferSelect;
export type SalaryResultRow = typeof salaryResults.$inferSelect;
