import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import type { DashboardResponse } from "@shared/types";
import { currentYearMonth } from "@shared/periods";
import { formatYen } from "@shared/calc";
import { findEmploymentType } from "@shared/income";
import { RankForm } from "../components/RankForm";
import { AllowanceForm } from "../components/AllowanceForm";
import { EmploymentForm } from "../components/EmploymentForm";
import { api } from "../api";

/** データ全削除の確認に入力させる語句。 */
const CONFIRM_PHRASE = "削除します";

/** 設定画面（PRD §8 画面5）。評価ランクの選択。期ごとに履歴を保持。 */
export function Settings({
  dashboard,
  reload,
}: {
  dashboard: DashboardResponse;
  reload: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  // 手当の削除エラーは手当カード内に表示する（error は削除モーダル内でのみ表示されるため）。
  const [allowanceError, setAllowanceError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteOpenChange = (open: boolean) => {
    setDeleteOpen(open);
    if (!open) {
      setConfirmText("");
      setError(null);
    }
  };

  const deleteAll = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteAllData();
      await reload();
      handleDeleteOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  const removeRank = async (id: string) => {
    if (!confirm("この評価ランク履歴を削除しますか？")) return;
    try {
      await api.deleteRank(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const removeAllowance = async (id: string) => {
    if (!confirm("この手当の設定を削除しますか？")) return;
    setAllowanceError(null);
    try {
      await api.deleteAllowance(id);
      await reload();
    } catch (e) {
      setAllowanceError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      {dashboard.rankProvisional && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              評価ランクが未設定のため、暫定的にランク1で給与を計算しています。下記でランクを設定すると、暫定表示は消えます。
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Card>
        <Card.Header>
          <Card.Title className="text-sm">現在の評価ランク</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="flex items-center gap-3">
            <Chip
              color={dashboard.rankProvisional ? "warning" : "accent"}
              variant="soft"
            >
              ランク {dashboard.currentRank}
              {dashboard.rankProvisional ? "（暫定）" : ""}
            </Chip>
            <span className="text-muted text-sm">
              {dashboard.rankProvisional
                ? "（未設定のため暫定値）"
                : `（${currentYearMonth()} 時点で適用中）`}
            </span>
          </div>
          <p className="text-muted mt-3 text-xs">
            評価ランクは人事評価で決まる枝番です。A-0 / A-1
            帯（40〜50万円）および固定額帯（40万円未満）ではランクに関わらず還元率が決まります。
          </p>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title className="text-sm">評価ランクの変更</Card.Title>
        </Card.Header>
        <Card.Content>
          <RankForm
            initialRank={dashboard.currentRank}
            reload={reload}
            saveLabel="保存して再計算"
          />
        </Card.Content>
      </Card>

      {dashboard.rankHistory.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">評価ランクの履歴</Card.Title>
          </Card.Header>
          <Card.Content>
            <ul className="divide-border divide-y">
              {[...dashboard.rankHistory]
                .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))
                .map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium">{h.effectiveFrom} 〜</span>
                      <span className="text-muted ml-3">ランク {h.rank}</span>
                    </div>
                    <Button
                      variant="danger-soft"
                      size="sm"
                      onPress={() => removeRank(h.id)}
                    >
                      削除
                    </Button>
                  </li>
                ))}
            </ul>
          </Card.Content>
        </Card>
      )}

      <Card>
        <Card.Header>
          <Card.Title className="text-sm">雇用形態・所定労働時間</Card.Title>
          <Card.Description className="text-xs">
            残業代の算出に使います（残業単価の分母＝月平均所定労働時間、みなし残業時間＝雇用形態）。
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <EmploymentForm settings={dashboard.settings} reload={reload} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title className="text-sm">特別手当の追加</Card.Title>
          <Card.Description className="text-xs">
            役職手当・職務手当・資格手当などを適用開始月付きで登録します。登録した月以降に継続適用されます。
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <AllowanceForm reload={reload} />
        </Card.Content>
      </Card>

      {dashboard.allowances.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">手当の履歴</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-3">
            {allowanceError && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{allowanceError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <ul className="divide-border divide-y">
              {[...dashboard.allowances]
                .sort((a, b) =>
                  a.effectiveFrom < b.effectiveFrom
                    ? 1
                    : a.effectiveFrom > b.effectiveFrom
                      ? -1
                      : a.name < b.name
                        ? -1
                        : 1,
                )
                .map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium">{a.effectiveFrom} 〜</span>
                      <span className="ml-3 font-medium">{a.name}</span>
                      <span className="text-muted ml-3">
                        {a.amount === 0
                          ? "廃止（0円）"
                          : `${formatYen(a.amount)} 円`}
                      </span>
                      {a.includeInOvertimeBase && (
                        <Chip color="accent" variant="soft" size="sm" className="ml-3">
                          残業基礎
                        </Chip>
                      )}
                    </div>
                    <Button
                      variant="danger-soft"
                      size="sm"
                      onPress={() => removeAllowance(a.id)}
                    >
                      削除
                    </Button>
                  </li>
                ))}
            </ul>
            <p className="text-muted mt-3 text-xs">
              現在の雇用形態は{" "}
              <strong className="text-foreground">
                {findEmploymentType(dashboard.settings.employmentType).label}
              </strong>{" "}
              です。「残業基礎」の手当（職務手当など）は残業単価の算出に算入されます。
            </p>
          </Card.Content>
        </Card>
      )}

      <Card className="border-danger/40 border">
        <Card.Header>
          <Card.Title className="text-sm">危険な操作</Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="text-muted text-sm">
            月単価・評価ランク履歴・給与スナップショット・残業時間・手当・設定をすべて削除します。
            アカウントは残り、ログインしたまま空の状態から再入力できます。この操作は取り消せません。
          </p>
          <Modal isOpen={deleteOpen} onOpenChange={handleDeleteOpenChange}>
            <div className="mt-4">
              <Button
                variant="danger"
                onPress={() => handleDeleteOpenChange(true)}
              >
                すべてのデータを削除
              </Button>
            </div>
            <Modal.Backdrop isDismissable={!deleting}>
              <Modal.Container size="sm">
                <Modal.Dialog>
                  <Modal.Header>
                    <Modal.Heading>
                      本当にすべてのデータを削除しますか？
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="space-y-4">
                    <p className="text-muted text-sm">
                      月単価・評価ランク履歴・給与スナップショットがすべて消去されます。この操作は取り消せません。
                    </p>
                    <TextField value={confirmText} onChange={setConfirmText}>
                      <Label>
                        確認のため{" "}
                        <strong className="text-foreground">
                          {CONFIRM_PHRASE}
                        </strong>{" "}
                        と入力してください
                      </Label>
                      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                      <Input autoFocus />
                    </TextField>
                    {error && (
                      <Alert status="danger">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Description>{error}</Alert.Description>
                        </Alert.Content>
                      </Alert>
                    )}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button
                      variant="secondary"
                      onPress={() => handleDeleteOpenChange(false)}
                      isDisabled={deleting}
                    >
                      キャンセル
                    </Button>
                    <Button
                      variant="danger"
                      onPress={deleteAll}
                      isDisabled={deleting || confirmText !== CONFIRM_PHRASE}
                    >
                      {deleting ? "削除中…" : "削除する"}
                    </Button>
                  </Modal.Footer>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </Card.Content>
      </Card>
    </div>
  );
}
