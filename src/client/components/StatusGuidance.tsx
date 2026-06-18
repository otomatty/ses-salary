import { Alert } from "@heroui/react";
import type { SalaryStatus } from "@shared/calc";
import { guidanceForStatus } from "@shared/guidance";

/** status -> Alert のステータス色。consult は警告、fixed/debut はアクセント。 */
const STATUS_TONE = {
  consult: "warning",
  fixed: "accent",
  debut: "accent",
} as const;

/**
 * 要相談・固定額など、自動計算が通常どおり働かないケースの案内パネル（PRD §12.4）。
 *
 * 「なぜ自動計算（還元率方式）が適用されないか（理由）」と
 * 「次に何をすべきか（行動）」を一貫した表現で示す。
 * ホーム・計算根拠・シミュレーションなど複数画面で共有する。
 */
export function StatusGuidance({
  status,
  compact = false,
}: {
  status: SalaryStatus;
  compact?: boolean;
}) {
  if (status === "ok") return null;

  const g = guidanceForStatus(status);
  if (!g) return null;

  return (
    <Alert status={STATUS_TONE[status]}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{g.headline}</Alert.Title>
        <Alert.Description>{g.reason}</Alert.Description>
        {!compact && (
          <p className="mt-2 rounded-md border border-current/20 bg-surface/60 px-2.5 py-1.5 text-xs font-medium leading-relaxed">
            <span className="mr-1" aria-hidden="true">
              →
            </span>
            {g.nextAction}
          </p>
        )}
      </Alert.Content>
    </Alert>
  );
}
