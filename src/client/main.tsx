import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "react-aria-components";
import { registerSW } from "virtual:pwa-register";
import "./styles.css";
import { App } from "./App";
import { ThemeProvider } from "./context/ThemeContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider locale="ja-JP">
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);

// Service Worker を登録し PWA をインストール可能にする。
// registerType: "autoUpdate" のため新しい SW を検知したら自動更新する。
registerSW({ immediate: true });
