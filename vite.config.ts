import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // VitePWA は cloudflare プラグインより前に置き、SW / manifest を
    // クライアント側の静的アセットとして生成させる。
    VitePWA({
      registerType: "autoUpdate",
      // public/logo.svg から生成したアイコンを manifest と <link> に自動注入する。
      pwaAssets: { config: true },
      manifest: {
        name: "エンジニア給与計算",
        short_name: "給与計算",
        description: "SES エンジニアの給与シミュレーション",
        lang: "ja",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        // 認証付き動的 API を SPA フォールバックに巻き込ませない。
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      // Cloudflare の dev サーバと SW が衝突するため開発時は無効化する。
      devOptions: { enabled: false },
    }),
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "./src/shared"),
    },
  },
});
