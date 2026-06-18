import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Spinner } from "@heroui/react";
import { useAppContext } from "./context/AppContext";
import { useOnboardingRedirect } from "./hooks/useOnboardingRedirect";
import { Layout } from "./pages/Layout";
import { Home } from "./pages/Home";
import { Prices } from "./pages/Prices";
import { Detail } from "./pages/Detail";
import { Simulate } from "./pages/Simulate";
import { Settings } from "./pages/Settings";
import { Onboarding } from "./pages/Onboarding";

function LoadingScreen() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

function AppShell() {
  const { dashboard, user, handleLogout } = useAppContext();
  // 初回利用者の誘導は専用 hook に委譲し、AppShell はレイアウトのみを担う。
  useOnboardingRedirect(dashboard);
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
