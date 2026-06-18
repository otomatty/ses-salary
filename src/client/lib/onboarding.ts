/**
 * オンボーディングの永続化ポリシーと誘導判定（純粋ロジック）。
 *
 * UI（ページ・ルーター・hook）から参照するため、React 非依存の関数だけを置く。
 * 「完了/スキップの記録」と「初回利用者をオンボーディングへ誘導すべきか」の
 * 判断をここに集約し、レイアウトやページに業務ロジックが漏れないようにする。
 */

import type { DashboardResponse } from "@shared/types";

/** オンボーディング完了/スキップを記録する localStorage キー。 */
export const ONBOARDING_DONE_KEY = "onboarding:done";

/** オンボーディングを完了済みとして記録する。 */
export function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* localStorage 不可環境（プライベートモード等）では何もしない。 */
  }
}

/** オンボーディング済みかどうか。 */
export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

/** データ未設定（月単価・評価ランク履歴がともに空）の初回利用者か。 */
export function isFreshUser(dashboard: DashboardResponse): boolean {
  return dashboard.prices.length === 0 && dashboard.rankHistory.length === 0;
}

/**
 * オンボーディングへ誘導すべきか。
 * 初回利用者で、未完了で、まだオンボーディング画面にいない場合に true。
 */
export function shouldRedirectToOnboarding(
  dashboard: DashboardResponse | null,
  pathname: string,
): boolean {
  if (!dashboard) return false;
  return (
    isFreshUser(dashboard) &&
    !isOnboardingDone() &&
    pathname !== "/onboarding"
  );
}
