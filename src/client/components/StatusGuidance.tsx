import type { SalaryStatus } from "@shared/calc";
import { guidanceForStatus } from "@shared/guidance";

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
  const g = guidanceForStatus(status);
  if (!g) return null;

  // consult は注意喚起寄り（amber）、fixed は中立的な案内（indigo）。
  const tone =
    status === "consult"
      ? {
          wrap: "border-amber-200 bg-amber-50",
          heading: "text-amber-800",
          body: "text-amber-700",
          actionWrap: "border-amber-200 bg-white/70",
          actionText: "text-amber-800",
        }
      : {
          wrap: "border-indigo-200 bg-indigo-50",
          heading: "text-indigo-800",
          body: "text-indigo-700",
          actionWrap: "border-indigo-200 bg-white/70",
          actionText: "text-indigo-800",
        };

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${tone.wrap}`}
      role="note"
    >
      <p className={`text-xs font-semibold ${tone.heading}`}>{g.headline}</p>
      <p className={`mt-1 text-xs leading-relaxed ${tone.body}`}>{g.reason}</p>
      {!compact && (
        <p
          className={`mt-2 rounded-md border px-2.5 py-1.5 text-xs font-medium leading-relaxed ${tone.actionWrap} ${tone.actionText}`}
        >
          <span className="mr-1" aria-hidden="true">
            →
          </span>
          {g.nextAction}
        </p>
      )}
    </div>
  );
}
