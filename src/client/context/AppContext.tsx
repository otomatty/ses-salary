import { createContext, useContext, type ReactNode } from "react";
import type { ApiUser, DashboardResponse } from "@shared/types";

export type AppContextValue = {
  user: ApiUser;
  dashboard: DashboardResponse | null;
  dashError: string | null;
  reload: () => Promise<void>;
  handleLogout: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AppContextValue;
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return ctx;
}
