import { useEffect, useMemo, useState } from "react";
import { currentYearMonth } from "@shared/periods";
import { monthHasPayableSalary } from "@shared/quarterSalary";
import type { RankHistoryDTO } from "@shared/types";
import type { MonthInput } from "../api";
import { api } from "../api";
import { buildYearMonthCells } from "./yearMonthStrip";
import { normalizeRankDraft } from "./rankStrip";

/**
 * 支給額が算出できる月向けの下書きフォーム（手当・残業など）の共通ロジック。
 */
export function usePayableDraftForm<T>({
  serverDraft,
  getValue,
  equal,
  toSavePayload,
  priceMap,
  rankHistory,
  consultRate,
  endMonth = currentYearMonth(),
  advanceWithoutChanges = false,
  onSaved,
  reload,
}: {
  serverDraft: Map<string, T>;
  getValue: (draft: Map<string, T>, ym: string) => T;
  equal: (a: T, b: T) => boolean;
  toSavePayload: (value: T) => Partial<MonthInput>;
  priceMap: Map<string, number>;
  rankHistory: RankHistoryDTO[];
  consultRate: number | null;
  endMonth?: string;
  advanceWithoutChanges?: boolean;
  onSaved?: () => void;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(serverDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(serverDraft);
  }, [serverDraft]);

  const rankDraft = useMemo(
    () => normalizeRankDraft(rankHistory),
    [rankHistory],
  );

  const payableMonths = useMemo(() => {
    const cells = buildYearMonthCells(endMonth);
    return cells
      .filter((c) =>
        monthHasPayableSalary(c.yearMonth, priceMap, rankDraft, consultRate),
      )
      .map((c) => c.yearMonth);
  }, [endMonth, priceMap, rankDraft, consultRate]);

  const hasChanges = useMemo(() => {
    const months = new Set([...draft.keys(), ...serverDraft.keys()]);
    for (const ym of months) {
      if (!equal(getValue(draft, ym), getValue(serverDraft, ym))) {
        return true;
      }
    }
    return false;
  }, [draft, serverDraft, equal, getValue]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const months = new Set([
        ...draft.keys(),
        ...serverDraft.keys(),
        ...payableMonths,
      ]);
      const ops: Promise<{ ok: true }>[] = [];
      for (const ym of months) {
        const next = getValue(draft, ym);
        const prev = getValue(serverDraft, ym);
        if (equal(next, prev)) continue;
        ops.push(api.saveMonth(ym, toSavePayload(next)));
      }
      if (ops.length === 0) {
        onSaved?.();
        return;
      }
      await Promise.all(ops);
      await reload();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = saving || (!advanceWithoutChanges && !hasChanges);

  return {
    draft,
    setDraft,
    rankDraft,
    consultRate,
    endMonth,
    payableMonths,
    error,
    save,
    saving,
    saveDisabled,
    hasChanges,
  };
}
