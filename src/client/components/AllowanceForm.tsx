import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Input,
  Label,
  NumberField,
  TextField,
} from "@heroui/react";
import { currentYearMonth } from "@shared/periods";
import { api } from "../api";

/**
 * 特別手当（役職手当など）の追加フォーム。
 * 名前付き手当を「適用開始月」付きで登録し、その月以降に継続適用する
 * （評価ランク履歴と同じ『最新が有効』方式）。金額0で保存すると廃止扱い。
 * 職務手当など残業単価の基礎に算入する手当は「残業基礎に含める」をオンにする。
 */
export function AllowanceForm({
  reload,
  saveLabel = "手当を追加",
}: {
  reload: () => Promise<void>;
  saveLabel?: string;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(currentYearMonth());
  const [includeInOvertimeBase, setIncludeInOvertimeBase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("手当名を入力してください。");
      return;
    }
    if (amount == null || !Number.isFinite(amount) || amount < 0) {
      setError("手当額を正しく入力してください（円）。");
      return;
    }
    setSaving(true);
    try {
      await api.saveAllowance({
        name: name.trim(),
        effectiveFrom,
        amount,
        includeInOvertimeBase,
      });
      setName("");
      setAmount(null);
      setIncludeInOvertimeBase(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextField value={name} onChange={setName} isRequired className="max-w-xs">
          <Label>手当名</Label>
          <Input placeholder="例: 役職手当 / 職務手当 / 資格手当" />
        </TextField>
        <NumberField
          value={amount ?? NaN}
          onChange={(v) => setAmount(Number.isNaN(v) ? null : v)}
          minValue={0}
          step={1000}
          isRequired
          formatOptions={{ useGrouping: true, maximumFractionDigits: 0 }}
        >
          <Label>手当額（円）</Label>
          <NumberField.Group>
            <NumberField.Input placeholder="例: 30000" />
            <span className="text-muted px-2 text-sm">円</span>
          </NumberField.Group>
        </NumberField>
        <TextField value={effectiveFrom} onChange={setEffectiveFrom} isRequired>
          <Label>適用開始月</Label>
          <Input type="month" />
        </TextField>
      </div>

      <Checkbox
        isSelected={includeInOvertimeBase}
        onChange={setIncludeInOvertimeBase}
      >
        残業単価の基礎に含める（職務手当など）
      </Checkbox>

      {error && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" isDisabled={saving}>
          {saving ? "保存中…" : saveLabel}
        </Button>
        <p className="text-muted text-xs">
          同じ手当名・同じ適用開始月で保存すると上書きされます。金額を
          <strong className="text-foreground">0</strong>
          で保存すると、その月以降は廃止扱いになります。
        </p>
      </div>
    </form>
  );
}
