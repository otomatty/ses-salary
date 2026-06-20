import { TIERS, type Tier } from "@shared/rateTable";

/**
 * Tech ランクのティア（Gold / Silver / Bronze）バッジ。
 * 金・銀・銅のメタリックなグラデーションで単価帯の「格」を視覚化する。
 * 色は styles.css の `.tier-badge` + `data-tier` トークンで制御する。
 */
export function TierBadge({
  tier,
  size = "md",
  showRange = false,
  className,
}: {
  tier: Tier;
  size?: "sm" | "md" | "lg";
  /** 単価レンジ（例: "単価 900千円〜"）を併記する */
  showRange?: boolean;
  className?: string;
}) {
  const info = TIERS[tier];
  return (
    <span
      className={`tier-badge${className ? ` ${className}` : ""}`}
      data-tier={tier}
      data-size={size}
    >
      <span className="tier-badge__label">{info.label}</span>
      {showRange && <span className="tier-badge__range">{info.rangeLabel}</span>}
    </span>
  );
}
