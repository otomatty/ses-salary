import { useMemo, useState } from "react";
import { Button, Card, ProgressBar } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import type { DashboardResponse } from "@shared/types";
import { PriceInputTabs } from "../components/PriceForms";
import { RankForm } from "../components/RankForm";
import { markOnboardingDone } from "../lib/onboarding";

const STEP_LABELS = ["ようこそ", "月単価の入力", "評価ランク", "完了"] as const;

/**
 * 初回利用者向けのオンボーディング専用ページ。
 * 「①アプリ説明 → ②月単価入力 → ③評価ランク設定 → ④完了」の順に案内する。
 * 先に月単価を入力することで、続く評価ランク設定で単価に応じた帯付きランク
 * （例: G-1 / G-2 / G-3）を提示できる。
 * 各ステップはスキップ可能で、完了/スキップ時に {@link markOnboardingDone} を記録する。
 */
export function Onboarding({
  dashboard,
  reload,
}: {
  dashboard: DashboardResponse;
  reload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const priceCount = dashboard.prices.length;

  const progress = useMemo(
    () => ((step + 1) / STEP_LABELS.length) * 100,
    [step],
  );

  const finish = () => {
    markOnboardingDone();
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="text-muted flex items-center justify-between text-xs">
          <span>
            ステップ {step + 1} / {STEP_LABELS.length}・{STEP_LABELS[step]}
          </span>
          <Button variant="ghost" size="sm" onPress={finish}>
            スキップして始める
          </Button>
        </div>
        <ProgressBar value={progress} aria-label="オンボーディングの進捗">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </div>

      {step === 0 && (
        <Card>
          <Card.Header>
            <Card.Title>エンジニア給与計算へようこそ</Card.Title>
            <Card.Description>
              案件の月単価から、四半期ごとの給与（額面）を自動で計算・予測・可視化します。
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex justify-end">
              <Button variant="primary" onPress={() => setStep(1)}>
                はじめる →
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">① 月単価を入力</Card.Title>
            <Card.Description className="text-xs">
              直近の案件単価を登録しましょう。連続する月が同じ単価なら「一括入力」が便利です。
            </Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <PriceInputTabs reload={reload} />

            <p className="text-muted text-xs">
              現在 <strong className="text-foreground">{priceCount} 件</strong>{" "}
              登録済みです。給与計算には直前四半期の3ヶ月分の単価が必要です。
            </p>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onPress={() => setStep(0)}>
                ← 戻る
              </Button>
              <Button variant="primary" onPress={() => setStep(2)}>
                次へ →
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">② 評価ランクを設定</Card.Title>
            <Card.Description className="text-xs">
              人事評価で決まる評価ランクを選びます。入力済みの単価に応じて G-1 /
              G-2 / G-3
              のように表示されます。未設定のままだと暫定ランク1で計算されます。
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <RankForm
              initialRank={dashboard.currentRank}
              prices={dashboard.prices}
              settings={dashboard.settings}
              reload={reload}
              saveLabel="保存して次へ →"
              onSaved={() => setStep(3)}
              footer={(saveButton) => (
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onPress={() => setStep(1)}>
                    ← 戻る
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="secondary" onPress={() => setStep(3)}>
                      あとで設定
                    </Button>
                    {saveButton}
                  </div>
                </div>
              )}
            />
          </Card.Content>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Card.Header>
            <Card.Title>設定が完了しました</Card.Title>
            <Card.Description>
              ホーム画面で給与の推移・今期・来期の予測を確認できます。
            </Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <ul className="text-muted space-y-2 text-sm">
              <li>
                ・評価ランク:{" "}
                <strong className="text-foreground">
                  ランク {dashboard.currentRank}
                  {dashboard.rankProvisional ? "（暫定）" : ""}
                </strong>
              </li>
              <li>
                ・登録済みの月単価:{" "}
                <strong className="text-foreground">{priceCount} 件</strong>
              </li>
            </ul>
            <p className="text-muted text-xs">
              月単価や評価ランクは、あとから「月単価の入力」「設定」画面でいつでも追加・変更できます。
            </p>
            <div className="flex items-center justify-between">
              <Button variant="ghost" onPress={() => setStep(2)}>
                ← 戻る
              </Button>
              <Button variant="primary" onPress={finish}>
                ホームへ →
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
