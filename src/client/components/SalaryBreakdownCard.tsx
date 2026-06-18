import type { ReactNode } from "react";
import { Alert, Card, Chip } from "@heroui/react";
import type { SalaryResult } from "@shared/periods";
import { formatYen, formatRate } from "@shared/calc";
import { guidanceForStatus } from "@shared/guidance";
import { StatusBadge } from "./StatusBadge";
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
  const guidance = guidanceForStatus(b.status);

  return (
    <Card>
      <Card.Header className="flex flex-row items-start justify-between gap-4">
        <div>
          <Card.Title className="text-sm">{title}</Card.Title>
          <Card.Description className="text-xs">
            {result.periodLabel} 適用
          </Card.Description>
        </div>
        <StatusBadge status={b.status} />
      </Card.Header>

      <Card.Content>
        {/* 給与額（主役） */}
        <div className="mb-5">
          {b.salary === null ? (
            <p className="text-3xl font-bold text-warning">
              {guidance?.badge ?? "—"}
            </p>
          ) : (
            <p className="text-3xl font-bold">
              {formatYen(b.salary)}
              <span className="text-muted ml-1 text-base font-normal">
                円
              </span>
            </p>
          )}
          <p className="text-muted text-xs">総支給（額面）</p>
        </div>

        {/* 内訳 */}
        <dl className="space-y-2 text-sm">
          <Row label="対象3ヶ月">
            <div className="flex flex-wrap justify-end gap-1.5">
              {b.months.map((m) => (
                <Chip key={m.yearMonth} size="sm" variant="soft">
                  {m.yearMonth}: {formatYen(m.unitPrice)}
                </Chip>
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
          <Row label="還元率">
            {b.rate === null ? "—" : formatRate(b.rate)}
          </Row>
          <Row label="計算式">
            <code className="bg-foreground text-background rounded px-2 py-1 text-xs">
              {b.formula}
            </code>
          </Row>
        </dl>

        {guidance ? (
          <div className="mt-4">
            <StatusGuidance status={b.status} />
          </div>
        ) : (
          b.note && (
            <p className="bg-surface-secondary text-muted mt-4 rounded-lg px-3 py-2 text-xs">
              {b.note}
            </p>
          )
        )}

        {/* 評価ランクが暫定（未設定）で、かつランクが計算に影響する帯のときに明示する（PRD §12.3） */}
        {result.rankProvisional && b.band.kind === "rank" && (
          <Alert status="warning" className="mt-3">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                評価ランクが未設定のため、暫定的にランク1で計算しています。設定画面でランクを登録すると、この暫定表示は消えます。
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </Card.Content>
    </Card>
  );
}

/** 内訳の1行（ラベルと値）。 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex items-start justify-between gap-4 border-b pb-2">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
