import type { ReactNode } from "react";
import type { SalaryResult } from "@shared/periods";
import { formatYen, formatRate } from "@shared/calc";
import { Badge, Card } from "./ui";
import { StatusGuidance } from "./StatusGuidance";

/**
 * 計算根拠の内訳表示（PRD §6.3）。
 * 対象3ヶ月・平均・帯・ランク・率・式を一画面で示し、手で検算できる状態にする。
 */
export function SalaryBreakdownCard({
  title,
  result,
}: {
  title: string;
  result: SalaryResult;
}) {
  const b = result.breakdown;
  const statusBadge =
    b.status === "consult" ? (
      <Badge tone="amber">要相談</Badge>
    ) : b.status === "fixed" ? (
      <Badge tone="indigo">固定額</Badge>
    ) : (
      <Badge tone="green">通常計算</Badge>
    );

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-xs text-slate-400">{result.periodLabel} 適用</p>
        </div>
        {statusBadge}
      </div>

      {/* 給与額（主役） */}
      <div className="mb-5">
        {b.salary === null ? (
          <p className="text-3xl font-bold text-amber-600">要相談</p>
        ) : (
          <p className="text-3xl font-bold text-slate-900">
            {formatYen(b.salary)}
            <span className="ml-1 text-base font-normal text-slate-500">円</span>
          </p>
        )}
        <p className="text-xs text-slate-400">総支給（額面）</p>
      </div>

      {/* 内訳 */}
      <dl className="space-y-2 text-sm">
        <Row label="対象3ヶ月">
          <div className="flex flex-wrap gap-1.5">
            {b.months.map((m) => (
              <span
                key={m.yearMonth}
                className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                {m.yearMonth}: {formatYen(m.unitPrice)}
              </span>
            ))}
          </div>
        </Row>
        <Row label="平均単価">{formatYen(b.avgUnitPrice)} 円</Row>
        <Row label="判定された帯">{b.band.label}</Row>
        <Row label="評価ランク">
          {b.status === "fixed" || b.band.kind === "single"
            ? "—（不問）"
            : result.rankProvisional
              ? `ランク ${b.rank}（暫定）`
              : `ランク ${b.rank}`}
        </Row>
        <Row label="還元率">{b.rate === null ? "—" : formatRate(b.rate)}</Row>
        <Row label="計算式">
          <code className="rounded bg-slate-900 px-2 py-1 text-xs text-slate-100">
            {b.formula}
          </code>
        </Row>
      </dl>

      {/* 要相談・固定額は理由＋次の行動を案内（PRD §12.4）。
          通常帯の補足（単一レート等）は従来どおり note を表示する。 */}
      {b.status === "consult" || b.status === "fixed" ? (
        <div className="mt-4">
          <StatusGuidance status={b.status} />
        </div>
      ) : (
        b.note && (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {b.note}
          </p>
        )
      )}

      {/* 評価ランクが暫定（未設定）で、かつランクが計算に影響する帯のときに明示する（PRD §12.3） */}
      {result.rankProvisional && b.band.kind === "rank" && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          評価ランクが未設定のため、暫定的にランク2で計算しています。設定画面でランクを登録すると、この暫定表示は消えます。
        </p>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}
