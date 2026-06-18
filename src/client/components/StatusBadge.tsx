import { Chip } from "@heroui/react";
import type { SalaryStatus } from "@shared/calc";
import { guidanceForStatus } from "@shared/guidance";

/** 給与計算結果の status に応じたバッジ（文言は guidance から導出）。 */
export function StatusBadge({
  status,
  bandCode,
}: {
  status: SalaryStatus;
  /** ok 時に帯コードを表示する場合（ホームサマリ等） */
  bandCode?: string;
}) {
  const g = guidanceForStatus(status);
  if (g) {
    return (
      <Chip color={status === "consult" ? "warning" : "accent"} variant="soft">
        {g.badge}
      </Chip>
    );
  }
  return (
    <Chip color="success" variant="soft">
      {bandCode ? `${bandCode} 帯` : "通常計算"}
    </Chip>
  );
}
