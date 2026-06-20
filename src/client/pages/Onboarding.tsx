import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Card, ProgressBar } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import type { DashboardResponse } from "@shared/types";
import { api } from "../api";
import { AllowanceForm } from "../components/AllowanceForm";
import { OvertimeForm } from "../components/OvertimeForm";
import { PriceYearEditor } from "../components/PriceYearEditor";
import { RankForm } from "../components/RankForm";
import { markOnboardingDone } from "../lib/onboarding";

const STEP_LABELS = [
  "ようこそ",
  "月単価の入力",
  "評価ランク",
  "特別手当",
  "残業時間",
  "完了",
] as const;

/**
 * 初回利用者向けのオンボーディング専用ページ。
 * 月単価 → 評価ランク → 特別手当 → 残業時間 → 完了の順に案内する。
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

  const [priceDraft, setPriceDraft] = useState<Map<string, number>>(
    () => new Map(dashboard.prices.map((p) => [p.yearMonth, p.unitPrice])),
  );
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const priceCount = dashboard.prices.length;

  const progress = useMemo(
    () => ((step + 1) / STEP_LABELS.length) * 100,
    [step],
  );

  const finish = () => {
    markOnboardingDone();
    navigate({ to: "/" });
  };

  const savePricesAndNext = async () => {
    setPriceError(null);
    const server = new Map(
      dashboard.prices.map((p) => [p.yearMonth, p.unitPrice]),
    );
    const upserts: { yearMonth: string; unitPrice: number }[] = [];
    for (const [ym, price] of priceDraft) {
      if (server.get(ym) !== price) upserts.push({ yearMonth: ym, unitPrice: price });
    }
    const deletes: string[] = [];
    for (const ym of server.keys()) {
      if (!priceDraft.has(ym)) deletes.push(ym);
    }

    if (upserts.length === 0 && deletes.length === 0) {
      setStep(2);
      return;
    }

    setPriceSaving(true);
    try {
      if (upserts.length > 0) await api.savePricesBulk(upserts);
      await Promise.all(deletes.map((ym) => api.deleteMonth(ym)));
      await reload();
      setStep(2);
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setPriceSaving(false);
    }
  };

  useEffect(() => {
    document.documentElement.classList.add("scrollbar-hidden");
    return () => document.documentElement.classList.remove("scrollbar-hidden");
  }, []);

  const stepFooter = (backStep: number, saveButton: ReactNode) => (
    <div className="flex items-center justify-between">
      <Button variant="ghost" onPress={() => setStep(backStep)}>
        ← 戻る
      </Button>
      {saveButton}
    </div>
  );

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
              直近1年の各月をクリックして単価を入力します。ドラッグ／Shift+クリックで範囲を選ぶと、同じ単価をまとめて設定できます。
            </Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <PriceYearEditor value={priceDraft} onChange={setPriceDraft} />

            {priceError && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{priceError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <p className="text-muted text-xs">
              給与計算には直前四半期（3ヶ月）分の単価が必要です。入力内容は「次へ」を押すまで保存されません。
            </p>

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onPress={() => setStep(0)}
                isDisabled={priceSaving}
              >
                ← 戻る
              </Button>
              <Button
                variant="primary"
                onPress={savePricesAndNext}
                isDisabled={priceSaving}
              >
                {priceSaving ? "保存中…" : "保存して次へ →"}
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
              人事評価で決まる評価ランクを、四半期（1–3 / 4–6 / 7–9 /
              10–12月）ごとに選びます。直前四半期の平均単価 ×
              還元率で基本給が決まります。
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <RankForm
              prices={dashboard.prices}
              priceMap={priceDraft}
              rankHistory={dashboard.rankHistory}
              settings={dashboard.settings}
              reload={reload}
              saveLabel="保存して次へ →"
              advanceWithoutChanges
              onSaved={() => setStep(3)}
              footer={(saveButton) => stepFooter(1, saveButton)}
            />
          </Card.Content>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">③ 特別手当を設定</Card.Title>
            <Card.Description className="text-xs">
              付与する手当を一覧から選び、金額を入力します。月をクリック／ドラッグで複数選択し「選択月に適用」で反映できます。
              残業基礎への算入は手当ごとにシステムで決まっています（職務手当などは残業代の計算に含まれます）。
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <AllowanceForm
              allowances={dashboard.allowances}
              priceMap={priceDraft}
              rankHistory={dashboard.rankHistory}
              settings={dashboard.settings}
              reload={reload}
              saveLabel="保存して次へ →"
              advanceWithoutChanges
              onSaved={() => setStep(4)}
              footer={(saveButton) => stepFooter(2, saveButton)}
            />
          </Card.Content>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <Card.Header>
            <Card.Title className="text-sm">④ 残業時間を入力</Card.Title>
            <Card.Description className="text-xs">
              各月の残業時間を入力すると、基本給に加えて残業代を見込めます。
              みなし残業（固定時間外手当）を超えた分のみ加算されます。
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <OvertimeForm
              overtime={dashboard.overtime}
              priceMap={priceDraft}
              rankHistory={dashboard.rankHistory}
              settings={dashboard.settings}
              reload={reload}
              saveLabel="保存して次へ →"
              advanceWithoutChanges
              onSaved={() => setStep(5)}
              footer={(saveButton) => stepFooter(3, saveButton)}
            />
          </Card.Content>
        </Card>
      )}

      {step === 5 && (
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
              月単価・手当・残業・評価ランクは、あとから各入力画面や「設定」でいつでも変更できます。
            </p>
            <div className="flex items-center justify-between">
              <Button variant="ghost" onPress={() => setStep(4)}>
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
