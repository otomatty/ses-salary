import {
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

// 単一のソース SVG（public/logo.svg）から PWA 用アイコンを一括生成する。
// 生成物は public/ 直下に出力され、ビルド時に静的アセットとして配信される。
export default defineConfig({
  preset: minimal2023Preset,
  images: ["public/logo.svg"],
});
