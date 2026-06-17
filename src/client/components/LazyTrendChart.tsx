import { lazy, Suspense } from "react";
import type { MonthlyPriceDTO } from "@shared/types";
import type { SalaryResult } from "@shared/periods";

/**
 * recharts は依存（d3 系）込みで重く、初期 JS バンドルの大半を占める。
 * グラフ本体を動的 import で別チャンクに切り出し、ホーム表示時にのみ読み込む。
 * これによりアプリ初期ロードの JS を削減する（PRD: バンドル削減）。
 */
const TrendChart = lazy(() =>
  import("./TrendChart").then((m) => ({ default: m.TrendChart })),
);

export function LazyTrendChart(props: {
  prices: MonthlyPriceDTO[];
  history: SalaryResult[];
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-72 items-center justify-center text-sm text-slate-400">
          グラフを読み込み中…
        </div>
      }
    >
      <TrendChart {...props} />
    </Suspense>
  );
}
