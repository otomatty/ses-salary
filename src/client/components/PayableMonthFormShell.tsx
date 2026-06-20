import { Alert, Button } from "@heroui/react";
import type { ReactNode } from "react";

/** 手当・残業フォームの共通シェル（エディタ＋空状態＋エラー＋保存）。 */
export function PayableMonthFormShell({
  editor,
  payableMonthsEmpty,
  error,
  footer,
  onSave,
  saving,
  saveDisabled,
  saveLabel = "保存",
}: {
  editor: ReactNode;
  payableMonthsEmpty: boolean;
  error: string | null;
  footer?: (saveButton: ReactNode) => ReactNode;
  onSave: () => void;
  saving: boolean;
  saveDisabled: boolean;
  saveLabel?: string;
}) {
  const saveButton = (
    <Button variant="primary" onPress={onSave} isDisabled={saveDisabled}>
      {saving ? "保存中…" : saveLabel}
    </Button>
  );

  return (
    <div className="space-y-4">
      {editor}

      {payableMonthsEmpty && (
        <p className="text-muted text-xs">
          支給額が算出できる月がありません。先に月単価と評価ランクを設定してください。
        </p>
      )}

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
