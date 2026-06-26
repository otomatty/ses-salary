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
import { compareYM } from "@shared/periods";
import { formatYen } from "@shared/calc";
import { CONSULT_CHART_SERIES } from "@shared/guidance";

/**
 * 単価・給与の推移グラフ（PRD §6.5）。ホーム画面の主役。
 * - 月単価: 入力された各月の単価
 * - 給与: 各適用月に適用される総支給。四半期点どうしは線で繋ぐ。要相談（salary が
 *   null）の期だけは線を切って欠損として扱い、別系列の「要相談」マーカーで明示する
 *   （PRD §12.4）。給与は四半期ごと（appliedFrom）の値しか無いため、専用データ
 *   salaryData として描き、月単価（全月）の欠損で線が途切れないようにしている。
 */
export function TrendChart({
  prices,
  history,
}: {
  prices: MonthlyPriceDTO[];
  history: SalaryResult[];
}) {
  // 各ラインは「自前の data を持つ系列」として対称に描く。
  // 以前はメインデータ（全月）に月単価を載せ、給与だけ専用 data で描いていたが、
  // recharts は「チャート data を使う系列」と「自前 data を持つ系列」を
  // allowDuplicatedCategory={false} の下で混在させると、両者で別々のカテゴリ
  // スケールを組んでしまい、月単価ライン（全月）が誤ったスケールに乗って直近月
  // （例: 5・6月）まで描かれない。全系列を自前 data に統一してスケールを揃える。
  const unitPriceData = [...prices]
    .sort((a, b) => compareYM(a.yearMonth, b.yearMonth))
    .map((p) => ({ month: p.yearMonth, unitPrice: p.unitPrice }));

  // 給与ラインは「四半期点（appliedFrom）だけ」を持つ専用データで描く。
  // 月単価は毎月あるが給与は四半期ごとなので、全月データに混ぜると四半期と四半期の
  // 間（給与が無い月）が欠損になり、connectNulls={false} では線がまったく繋がらない
  // （点が孤立する）。専用データにすれば隣接する四半期点どうしが配列上の隣り合う要素に
  // なり、connectNulls={false} のままでも線が繋がる。要相談（salary === null）の期は
  // そのまま break として残るので、その四半期だけ線が切れ、別系列のオレンジマーカーで
  // 「要相談」を明示できる（PRD §12.4）。
  const salaryData = [...history]
    .sort((a, b) => compareYM(a.appliedFrom, b.appliedFrom))
    .map((r) => ({ month: r.appliedFrom, salary: r.breakdown.salary }));

  // 要相談（自動計算対象外）の期に、その月の単価（無ければ平均単価）の高さで
  // マーカーを置く専用データ。これも自前 data の系列として描く。
  const priceByMonth = new Map(prices.map((p) => [p.yearMonth, p.unitPrice]));
  const consultData = history
    .filter(
      (r) => r.breakdown.salary === null && r.breakdown.status === "consult",
    )
    .sort((a, b) => compareYM(a.appliedFrom, b.appliedFrom))
    .map((r) => ({
      month: r.appliedFrom,
      consultMark: priceByMonth.get(r.appliedFrom) ?? r.breakdown.avgUnitPrice,
    }));
  const hasConsult = consultData.length > 0;

  // Y軸ドメインを単価・給与の両系列の最大値から明示的に算出する。
  // 給与ラインは独自 data（salaryData）を持つため、recharts の自動ドメインだと
  // チャート全体の data 側にある単価（unitPrice）が軸の範囲計算に反映されず、
  // 単価（給与より大きいことが多い）が軸の上端からはみ出して見えなくなる。
  // 両系列の最大値を 10万単位で切り上げた値を上端に固定して、必ず両方が収まるようにする。
  const yMax = Math.max(
    0,
    ...prices.map((p) => p.unitPrice),
    ...history.map((r) => r.breakdown.salary ?? 0),
  );
  const yDomainMax = yMax > 0 ? Math.ceil(yMax / 100000) * 100000 : undefined;

  if (unitPriceData.length === 0 && salaryData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        データがありません。月単価を入力するとグラフが表示されます。
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            // 給与ラインだけ専用データ（四半期点のみ）を渡すため、月単価ラインの
            // 全月データと給与ラインの四半期データをカテゴリ軸上で正しく重ねるには
            // 重複カテゴリを許可しない設定が必要（recharts の複数データ系列の定石）。
            allowDuplicatedCategory={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            width={56}
            domain={yDomainMax ? [0, yDomainMax] : undefined}
            tickFormatter={(v: number) => `${Math.round(v / 10000)}万`}
          />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === CONSULT_CHART_SERIES
                ? ["自動計算の対象外", name]
                : [`${formatYen(value)} 円`, name]
            }
            labelStyle={{ color: "#0f172a" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            // 全月の月単価。給与・要相談ラインと同じく自前 data を持つ系列にして
            // カテゴリ軸のスケールを揃える（混在させると直近月が描かれない）。
            data={unitPriceData}
            type="monotone"
            dataKey="unitPrice"
            name="月単価"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            // 四半期点のみの専用データ。隣接する四半期どうしは線で繋ぎ、
            // 要相談（salary === null）の期では線を切る（connectNulls={false}）。
            data={salaryData}
            type="monotone"
            dataKey="salary"
            name="給与(総支給)"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
          />
          {/* 要相談（自動計算対象外）の期を明示するマーカー。線は引かず点のみ。 */}
          {hasConsult && (
            <Line
              data={consultData}
              type="monotone"
              dataKey="consultMark"
              name={CONSULT_CHART_SERIES}
              stroke="transparent"
              strokeWidth={0}
              legendType="circle"
              dot={{
                r: 5,
                fill: "#f59e0b",
                stroke: "#ffffff",
                strokeWidth: 1.5,
              }}
              activeDot={{ r: 6, fill: "#f59e0b" }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
