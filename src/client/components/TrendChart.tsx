import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { MonthlyPriceDTO } from "@shared/types";
import type { SalaryResult } from "@shared/periods";
import { formatYen } from "@shared/calc";

/**
 * 単価・給与の推移グラフ（PRD §6.5）。ホーム画面の主役。
 * - 月単価: 入力された各月の単価
 * - 給与: 各適用月に適用される総支給（要相談・固定額も折れ線に反映）
 */
export function TrendChart({
  prices,
  history,
}: {
  prices: MonthlyPriceDTO[];
  history: SalaryResult[];
}) {
  // 月 -> { unitPrice, salary } のマップを作り、全月を結合する。
  const map = new Map<
    string,
    { month: string; unitPrice?: number; salary?: number }
  >();

  for (const p of prices) {
    map.set(p.yearMonth, { month: p.yearMonth, unitPrice: p.unitPrice });
  }
  for (const r of history) {
    const month = r.appliedFrom;
    const entry = map.get(month) ?? { month };
    if (r.breakdown.salary !== null) entry.salary = r.breakdown.salary;
    map.set(month, entry);
  }

  const data = Array.from(map.values()).sort((a, b) =>
    a.month < b.month ? -1 : 1,
  );

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        データがありません。月単価を入力するとグラフが表示されます。
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            width={56}
            tickFormatter={(v: number) => `${Math.round(v / 10000)}万`}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${formatYen(value)} 円`,
              name,
            ]}
            labelStyle={{ color: "#0f172a" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="unitPrice"
            name="月単価"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="salary"
            name="給与(総支給)"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
