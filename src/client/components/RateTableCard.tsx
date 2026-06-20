import type { ReactNode } from "react";
import { Card, Table } from "@heroui/react";
import { formatYen, formatRate } from "@shared/calc";
import { CONSULT_GUIDANCE } from "@shared/guidance";
import { RATE_BANDS } from "@shared/rateTable";

/**
 * 早見表マスタ（還元率テーブル）。会社共通の固定マスタを表示する。
 * 平均単価の帯と評価ランクから還元率が決まることを示す参照用テーブル。
 */
export function RateTableCard() {
  return (
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
  );
}
