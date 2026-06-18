import { useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Input,
  Label,
  Radio,
  RadioGroup,
  TextField,
} from "@heroui/react";
import { currentYearMonth } from "@shared/periods";
import type { Rank } from "@shared/rateTable";
import { api } from "../api";

/**
 * 評価ランクの設定フォーム（ランク選択＋適用開始月＋保存）。
 * 設定画面とオンボーディングの両方から使う共有コンポーネント
 * （フォームのドリフトを防ぐため `api.saveRank` 呼び出しと state をここに集約）。
 *
 * 保存ボタン周りのレイアウトはページごとに異なるため、`footer` レンダープロップで
 * 保存ボタンを受け取り、各ページが他のボタン（戻る/スキップ等）と並べて配置できる。
 */
export function RankForm({
  initialRank,
  reload,
  onSaved,
  saveLabel = "保存",
  footer,
}: {
  initialRank: Rank;
  reload: () => Promise<void>;
  /** 保存・再読込が成功したあとに呼ばれる（オンボーディングの次ステップ遷移などに使う）。 */
  onSaved?: () => void;
  saveLabel?: string;
  /** 保存ボタンを受け取り、他のアクションと並べて配置するためのスロット。 */
  footer?: (saveButton: ReactNode) => ReactNode;
}) {
  const [rank, setRank] = useState<Rank>(initialRank);
  const [effectiveFrom, setEffectiveFrom] = useState(currentYearMonth());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveRank(rank, effectiveFrom);
      await reload();
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <Button variant="primary" onPress={save} isDisabled={saving}>
      {saving ? "保存中…" : saveLabel}
    </Button>
  );

  return (
    <div className="space-y-4">
      <RadioGroup
        value={String(rank)}
        onChange={(v) => setRank(Number(v) as Rank)}
        orientation="horizontal"
      >
        <Label>ランクを選択</Label>
        <div className="flex gap-4">
          {([1, 2, 3] as Rank[]).map((r) => (
            <Radio key={r} value={String(r)}>
              ランク {r}
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <TextField
        value={effectiveFrom}
        onChange={setEffectiveFrom}
        className="max-w-xs"
      >
        <Label>適用開始月</Label>
        <Input type="month" />
        <p className="text-muted mt-1 text-xs">
          この月以降に適用される給与計算でこのランクが使われます。
        </p>
      </TextField>

      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {footer ? footer(saveButton) : saveButton}
    </div>
  );
}
