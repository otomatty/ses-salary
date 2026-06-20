import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/** ユーザー（エンジニア本人） */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"), // Google プロフィール画像URL（未取得は null）
  createdAt: integer("created_at").notNull(), // unix ms
});

/**
 * 月ごとの入力（単価＋残業時間）を1行に統合（年月ごとに1件）。
 * 「月ごとに単価・残業・手当を入力する」月別ページの主データ。
 */
export const monthlyEntries = sqliteTable(
  "monthly_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(), // "YYYY-MM"
    unitPrice: integer("unit_price").notNull(), // 円
    // 月次の残業時間（区分別）。未入力は 0。
    overtimeNormalHours: real("overtime_normal_hours").notNull().default(0),
    overtimeNightHours: real("overtime_night_hours").notNull().default(0),
    overtimeHolidayHours: real("overtime_holiday_hours").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    userMonthUnique: uniqueIndex("monthly_entries_user_month_unique").on(
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

/** 本人設定（雇用形態・所定労働時間など）。ユーザーごとに1件。 */
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  employmentType: text("employment_type").notNull(),
  monthlyStandardHours: real("monthly_standard_hours").notNull(),
  // みなし残業時間のオーバーライド。null なら雇用形態から導出する。
  deemedOvertimeHours: real("deemed_overtime_hours"),
  // M帯(要相談 / 140万円以上)の手動還元率(%)。null なら従来どおり要相談（自動計算外）。
  consultRate: real("consult_rate"),
  updatedAt: integer("updated_at").notNull(),
});

/** 月ごとの手当（年月 × 手当名ごとに1件）。月別入力。 */
export const monthlyAllowances = sqliteTable(
  "monthly_allowances",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(), // "YYYY-MM"
    name: text("name").notNull(),
    amount: integer("amount").notNull(), // 円
    // 残業単価の基礎（基本給 + 職務手当）に算入するか（0|1）。
    includeInOvertimeBase: integer("include_in_overtime_base").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    userMonthNameUnique: uniqueIndex(
      "monthly_allowances_user_month_name_unique",
    ).on(t.userId, t.yearMonth, t.name),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type MonthlyEntryRow = typeof monthlyEntries.$inferSelect;
export type RankHistoryRow = typeof rankHistory.$inferSelect;
export type SalaryResultRow = typeof salaryResults.$inferSelect;
export type UserSettingsRow = typeof userSettings.$inferSelect;
export type MonthlyAllowanceRow = typeof monthlyAllowances.$inferSelect;
