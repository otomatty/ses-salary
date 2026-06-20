import { useId, type KeyboardEvent } from "react";
import { Label } from "@heroui/react";
import { formatRate } from "@shared/calc";
import type { RateBand, Rank } from "@shared/rateTable";

const RANKS: Rank[] = [1, 2, 3];

function rankTitle(band: RateBand | null, rank: Rank): string {
  return band?.kind === "rank" ? `${band.code}-${rank}` : `ランク ${rank}`;
}

function rankDetail(band: RateBand | null, rank: Rank): string | null {
  if (band?.kind === "rank" && band.rates) {
    return formatRate(band.rates[rank]);
  }
  if (band?.kind === "single" && band.rate != null) {
    return formatRate(band.rate);
  }
  if (band?.kind === "fixed") {
    return "固定額";
  }
  if (band?.kind === "consult") {
    return "要相談";
  }
  return null;
}

/**
 * 評価ランク（1 / 2 / 3）をカード型のセグメントで選ぶ UI。
 * 帯が判明しているときは H-1 形式の表記と還元率を併記する。
 */
export function RankSelector({
  value,
  onChange,
  band,
  label = "ランクを選択",
  showLabel = true,
}: {
  value: Rank;
  onChange: (rank: Rank) => void;
  band: RateBand | null;
  label?: string;
  showLabel?: boolean;
}) {
  const labelId = useId();

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, rank: Rank) => {
    const index = RANKS.indexOf(rank);
    let next: Rank | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = RANKS[(index + 1) % RANKS.length];
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = RANKS[(index - 1 + RANKS.length) % RANKS.length];
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(next);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-rank="${next}"]`)
      ?.focus();
  };

  return (
    <div className="rank-selector">
      {showLabel && (
        <Label id={labelId} className="rank-selector__label">
          {label}
        </Label>
      )}
      <div
        className="rank-selector__grid"
        role="radiogroup"
        aria-labelledby={showLabel ? labelId : undefined}
        aria-label={showLabel ? undefined : label}
      >
        {RANKS.map((rank) => {
          const selected = value === rank;
          const detail = rankDetail(band, rank);

          return (
            <button
              key={rank}
              type="button"
              role="radio"
              data-rank={rank}
              aria-checked={selected}
              className="rank-selector__option"
              data-selected={selected || undefined}
              onClick={() => onChange(rank)}
              onKeyDown={(event) => handleKeyDown(event, rank)}
            >
              <span className="rank-selector__rank-badge" aria-hidden>
                {rank}
              </span>
              <span className="rank-selector__title">{rankTitle(band, rank)}</span>
              {detail && (
                <span className="rank-selector__detail">{detail}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
