import type { ReactNode } from "react";
import { Button, Card, Chip, Table } from "@heroui/react";
import type { DashboardResponse, SalaryResultDTO } from "@shared/types";
import { formatYen, formatRate } from "@shared/calc";
import { CONSULT_GUIDANCE } from "@shared/guidance";
import { RATE_BANDS } from "@shared/rateTable";
import { SalaryBreakdownCard } from "../components/SalaryBreakdownCard";
import { navigate } from "../router";

/** 計算根拠の内訳（PRD §8 画面4 / §6.3）。検算用。 */
export function Detail({ dashboard }: { dashboard: DashboardResponse }) {
  const hasAny = dashboard.current || dashboard.next;

  // 適用月 → 保存済み（確定）スナップショット
  const savedByMonth = new Map<string, SalaryResultDTO>(
    dashboard.savedResults.map((s) => [s.appliedFrom, s]),
  );

  return (
    <div className="space-y-6">
      {!hasAny ? (
        <Card>
          <Card.Content className="py-6 text-center text-sm">
            <p className="text-muted">
              計算根拠を表示するには、前四半期（3ヶ月）の月単価が必要です。
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onPress={() => navigate("prices")}
            >
              月単価を入力する →
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dashboard.current && (
            <SalaryBreakdownCard title="今期の給与" result={dashboard.current} />
          )}
          {dashboard.next && (
            <SalaryBreakdownCard
              title="来期の給与（予測）"
              result={dashboard.next}
            />
          )}
        </div>
      )}

      {/* 過去の計算結果一覧 */}
      {dashboard.history.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">計算結果の履歴</Card.Title>
            <Card.Description className="text-xs">
              <span className="text-success font-medium">確定</span>
              は保存済みスナップショット（当時の率・額をそのまま保持）、
              <span className="text-muted font-medium">再計算</span>
              は現行の早見表で再計算した値です。早見表改定後は両者が異なる場合があります。
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Table>
              <Table.Content aria-label="計算結果の履歴">
                <Table.Header>
                  <Table.Column id="period" isRowHeader>
                    適用期間
                  </Table.Column>
                  <Table.Column id="kind">区分</Table.Column>
                  <Table.Column id="avg">平均単価</Table.Column>
                  <Table.Column id="band">帯</Table.Column>
                  <Table.Column id="rank">ランク</Table.Column>
                  <Table.Column id="rate">還元率</Table.Column>
                  <Table.Column id="salary" className="text-right">
                    給与
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {[...dashboard.history].reverse().map((r) => {
                    const saved = savedByMonth.get(r.appliedFrom);
                    // 確定値があれば確定値を主表示し、再計算値と異なれば併記する。
                    const b = r.breakdown;
                    const band = saved ? saved.appliedBand : b.band.code;
                    const isSingleOrFixed =
                      b.status === "fixed" || b.band.kind === "single";
                    const savedBandKind = saved
                      ? RATE_BANDS.find((x) => x.code === saved.appliedBand)?.kind
                      : undefined;
                    const rankCell = saved
                      ? saved.appliedRate === null || savedBandKind === "single"
                        ? "—"
                        : saved.appliedRank
                      : isSingleOrFixed
                        ? "—"
                        : b.rank;
                    const rate = saved ? saved.appliedRate : b.rate;
                    const salary = saved ? saved.salary : b.salary;
                    const recalcDiffers =
                      saved != null &&
                      (saved.salary !== b.salary ||
                        saved.appliedRate !== b.rate ||
                        saved.appliedBand !== b.band.code);
                    return (
                      <Table.Row key={r.appliedFrom} id={r.appliedFrom}>
                        <Table.Cell className="whitespace-nowrap">
                          {r.periodLabel}
                        </Table.Cell>
                        <Table.Cell>
                          {saved ? (
                            <Chip color="success" variant="soft" size="sm">
                              確定
                            </Chip>
                          ) : (
                            <Chip color="default" variant="soft" size="sm">
                              再計算
                            </Chip>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {formatYen(saved ? saved.avgUnitPrice : b.avgUnitPrice)}
                        </Table.Cell>
                        <Table.Cell>{band}</Table.Cell>
                        <Table.Cell>{rankCell}</Table.Cell>
                        <Table.Cell>
                          {rate === null ? "—" : formatRate(rate)}
                        </Table.Cell>
                        <Table.Cell className="text-right font-medium">
                          {salary === null
                            ? CONSULT_GUIDANCE.badge
                            : formatYen(salary)}
                          {recalcDiffers && (
                            <span className="text-warning block text-xs font-normal">
                              再計算:{" "}
                              {b.salary === null
                                ? CONSULT_GUIDANCE.badge
                                : formatYen(b.salary)}
                            </span>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table>
          </Card.Content>
        </Card>
      )}

      {/* 早見表マスタ */}
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">早見表マスタ（還元率テーブル）</Card.Title>
          <Card.Description className="text-xs">
            会社共通の固定マスタです。平均単価の帯と評価ランクから還元率が決まります。
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Table>
            <Table.Content aria-label="早見表マスタ">
              <Table.Header>
                <Table.Column id="band" isRowHeader>
                  帯
                </Table.Column>
                <Table.Column id="range">平均単価（円）</Table.Column>
                <Table.Column id="r1" className="text-right">
                  ランク1
                </Table.Column>
                <Table.Column id="r2" className="text-right">
                  ランク2
                </Table.Column>
                <Table.Column id="r3" className="text-right">
                  ランク3
                </Table.Column>
              </Table.Header>
              <Table.Body>
                {RATE_BANDS.map((b) => {
                  const range =
                    b.max === null
                      ? `${formatYen(b.min)} 〜`
                      : b.min === 0
                        ? `〜 ${formatYen(b.max)}`
                        : `${formatYen(b.min)} 〜 ${formatYen(b.max)}`;
                  let cells: ReactNode;
                  if (b.kind === "consult") {
                    cells = (
                      <Table.Cell colSpan={3} className="text-warning text-right">
                        {CONSULT_GUIDANCE.badge}
                      </Table.Cell>
                    );
                  } else if (b.kind === "fixed") {
                    cells = (
                      <Table.Cell colSpan={3} className="text-accent text-right">
                        一律 {formatYen(b.fixedAmount ?? 0)} 円
                      </Table.Cell>
                    );
                  } else if (b.kind === "single") {
                    cells = (
                      <Table.Cell colSpan={3} className="text-right">
                        {formatRate(b.rate ?? 0)}（単一）
                      </Table.Cell>
                    );
                  } else {
                    cells = (
                      <>
                        <Table.Cell className="text-right">
                          {formatRate(b.rates![1])}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {formatRate(b.rates![2])}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {formatRate(b.rates![3])}
                        </Table.Cell>
                      </>
                    );
                  }
                  return (
                    <Table.Row key={b.code} id={b.code}>
                      <Table.Cell className="font-medium">{b.code}</Table.Cell>
                      <Table.Cell className="text-muted whitespace-nowrap">
                        {range}
                      </Table.Cell>
                      {cells}
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table>
        </Card.Content>
      </Card>
    </div>
  );
}
