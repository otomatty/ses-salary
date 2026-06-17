import type { DashboardResponse } from "@shared/types";
import { formatYen } from "@shared/calc";
import { guidanceForStatus } from "@shared/guidance";
import type { SalaryResult } from "@shared/periods";
import {
  Card,
  SectionTitle,
  Button,
  ErrorBanner,
  NoticeBanner,
} from "../components/ui";
import { LazyTrendChart } from "../components/LazyTrendChart";
import { StatusBadge } from "../components/StatusBadge";
import { StatusGuidance } from "../components/StatusGuidance";
import { navigate } from "../router";

/** ホーム画面（PRD §8 画面2）。推移グラフを主役に、今期・来期サマリを表示。 */
export function Home({
  dashboard,
  error,
}: {
  dashboard: DashboardResponse;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      {/* 評価ランク未設定時の明示＋設定画面への誘導（PRD §12.3） */}
      {dashboard.rankProvisional && (
        <NoticeBanner>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">評価ランク未設定（暫定ランク2で計算中）</p>
              <p className="mt-0.5 text-xs text-amber-700">
                人事評価で決まる評価ランクがまだ設定されていません。正確な給与計算のため、設定画面でランクを登録してください。
              </p>
            </div>
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() => navigate("settings")}
            >
              評価ランクを設定 →
            </Button>
          </div>
        </NoticeBanner>
      )}

      {/* 推移グラフ（主役） */}
      <Card>
        <SectionTitle>単価・給与の推移</SectionTitle>
        <LazyTrendChart prices={dashboard.prices} history={dashboard.history} />
      </Card>

      {/* 今期・来期サマリ */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label="今期の給与"
          result={dashboard.current}
          emptyText="今期に適用される給与を計算するには、直近3ヶ月の単価が必要です。"
        />
        <SummaryCard
          label="来期の給与（予測）"
          result={dashboard.next}
          emptyText={dashboard.nextPending ?? "来期の給与はまだ計算できません。"}
          highlight
        />
      </div>

      {/* 各画面への入口 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NavTile
          title="月単価の入力"
          desc="各月の単価を追加・編集"
          onClick={() => navigate("prices")}
        />
        <NavTile
          title="計算根拠の内訳"
          desc="帯・ランク・率・式を確認"
          onClick={() => navigate("detail")}
        />
        <NavTile
          title="単価シミュレーション"
          desc="仮単価で次の給与を試算"
          onClick={() => navigate("simulate")}
        />
        <NavTile
          title="設定"
          desc="評価ランクの選択"
          onClick={() => navigate("settings")}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  result,
  emptyText,
  highlight = false,
}: {
  label: string;
  result: SalaryResult | null;
  emptyText: string;
  highlight?: boolean;
}) {
  const guidance = result ? guidanceForStatus(result.breakdown.status) : null;

  return (
    <Card className={highlight ? "ring-2 ring-indigo-100" : ""}>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>{label}</SectionTitle>
        {result && (
          <StatusBadge
            status={result.breakdown.status}
            bandCode={result.breakdown.band.code}
          />
        )}
      </div>

      {!result ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <div>
          {result.breakdown.salary === null ? (
            <p className="text-2xl font-bold text-amber-600">
              {guidance?.badge ?? "—"}
            </p>
          ) : (
            <p className="text-3xl font-bold text-slate-900">
              {formatYen(result.breakdown.salary)}
              <span className="ml-1 text-base font-normal text-slate-500">円</span>
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {result.periodLabel} 適用
            {result.breakdown.salary !== null && (
              <>
                {" "}
                ・ 平均単価 {formatYen(result.breakdown.avgUnitPrice)} 円
              </>
            )}
          </p>
          {result.rankProvisional &&
            result.breakdown.band.kind === "rank" && (
              <p className="mt-1 text-xs font-medium text-amber-600">
                暫定ランク2で計算中
              </p>
            )}
          {guidance && (
            <div className="mt-3">
              <StatusGuidance status={result.breakdown.status} compact />
            </div>
          )}
          <div className="mt-3">
            <Button variant="ghost" onClick={() => navigate("detail")}>
              計算根拠を見る →
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function NavTile({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow"
    >
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </button>
  );
}
