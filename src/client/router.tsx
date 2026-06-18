import { useEffect, useRef } from "react";
import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Spinner } from "@heroui/react";
import { useAppContext } from "./context/AppContext";
import { Layout } from "./pages/Layout";
import { Home } from "./pages/Home";
import { Prices } from "./pages/Prices";
import { Detail } from "./pages/Detail";
import { Simulate } from "./pages/Simulate";
import { Settings } from "./pages/Settings";
import { Onboarding, isOnboardingDone } from "./pages/Onboarding";

function LoadingScreen() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

function AppShell() {
  const { dashboard, user, handleLogout } = useAppContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // 初回（データが空＝未設定）の利用者を一度だけオンボーディングへ誘導する。
  // ref で「セッション中1回だけ」に制限し、ホーム等への遷移をブロックしない。
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!dashboard || redirectedRef.current) return;
    const fresh =
      dashboard.prices.length === 0 && dashboard.rankHistory.length === 0;
    if (fresh && !isOnboardingDone() && pathname !== "/onboarding") {
      redirectedRef.current = true;
      navigate({ to: "/onboarding" });
    }
  }, [dashboard, pathname, navigate]);

  if (!dashboard) return <LoadingScreen />;
  return <Layout user={user} onLogout={handleLogout} />;
}

function HomeRoute() {
  const { dashboard, dashError } = useAppContext();
  return <Home dashboard={dashboard!} error={dashError} />;
}

function PricesRoute() {
  const { dashboard, dashError, reload } = useAppContext();
  return (
    <Prices dashboard={dashboard!} reload={reload} error={dashError} />
  );
}

function DetailRoute() {
  const { dashboard } = useAppContext();
  return <Detail dashboard={dashboard!} />;
}

function SimulateRoute() {
  const { dashboard } = useAppContext();
  return <Simulate dashboard={dashboard!} />;
}

function SettingsRoute() {
  const { dashboard, reload } = useAppContext();
  return <Settings dashboard={dashboard!} reload={reload} />;
}

function OnboardingRoute() {
  const { dashboard, reload } = useAppContext();
  return <Onboarding dashboard={dashboard!} reload={reload} />;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <Navigate to="/" />,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: HomeRoute,
});

const pricesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/prices",
  component: PricesRoute,
});

const detailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/detail",
  component: DetailRoute,
});

const simulateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/simulate",
  component: SimulateRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsRoute,
});

const onboardingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/onboarding",
  component: OnboardingRoute,
});

const routeTree = rootRoute.addChildren([
  appRoute.addChildren([
    indexRoute,
    pricesRoute,
    detailRoute,
    simulateRoute,
    settingsRoute,
    onboardingRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
