import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { DashboardResponse } from "@shared/types";
import { shouldRedirectToOnboarding } from "../lib/onboarding";

/**
 * 初回（データ未設定）の利用者をセッション中1回だけオンボーディングへ誘導する。
 * 判定ロジックは {@link shouldRedirectToOnboarding} に委譲し、ここでは副作用
 * （遷移）だけを扱う。ref で1回に制限し、以降の任意画面への遷移はブロックしない。
 */
export function useOnboardingRedirect(
  dashboard: DashboardResponse | null,
): void {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (shouldRedirectToOnboarding(dashboard, pathname)) {
      redirectedRef.current = true;
      navigate({ to: "/onboarding" });
    }
  }, [dashboard, pathname, navigate]);
}
