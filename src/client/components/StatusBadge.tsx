import type { SalaryStatus } from "@shared/calc";
import { guidanceForStatus } from "@shared/guidance";
import { Badge } from "./ui";

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
      <Badge tone={status === "consult" ? "amber" : "indigo"}>{g.badge}</Badge>
    );
  }
  return (
    <Badge tone="green">{bandCode ? `${bandCode} 帯` : "通常計算"}</Badge>
  );
}
