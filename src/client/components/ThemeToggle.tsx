import { useRef } from "react";
import { flushSync } from "react-dom";
import { Button } from "@heroui/react";
import { useTheme, type Theme } from "../context/ThemeContext";

/** テーマ切替リビールの長さ（ms）。 */
const VT_DURATION = 500;

/** 太陽アイコン（ライト時に表示）。 */
function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/** 月アイコン（ダーク時に表示）。 */
function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/** View Transitions API（lib.dom にまだ無いブラウザ向け）の最小型。 */
type DocumentWithViewTransition = {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<unknown>;
    ready: Promise<unknown>;
  };
};

/** 視差効果を減らす設定が有効か。 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * ヘッダー用のライト／ダークテーマ切り替えボタン。
 *
 * Magic UI の AnimatedThemeToggler を参考に、View Transitions API で
 * クリックしたボタン位置から円形に新テーマを展開する。API 非対応や
 * reduce-motion 時は通常の即時切替にフォールバックする。
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  // 展開の起点（ボタン中心）を測るためのラッパー。
  const wrapRef = useRef<HTMLSpanElement>(null);

  const runToggle = () => {
    const next: Theme = isDark ? "light" : "dark";

    // テーマの実適用。View Transitions のスナップショットが新テーマを
    // 捉えられるよう、dark クラスを同期的に確定してから state を更新する
    //（ThemeProvider の effect も同じ値を冪等に再適用するだけ）。
    const apply = () => {
      document.documentElement.classList.toggle("dark", next === "dark");
      setTheme(next);
    };

    const startViewTransition = (document as DocumentWithViewTransition)
      .startViewTransition;

    // 非対応 or reduce-motion はアニメ無しで切り替える。
    if (typeof startViewTransition !== "function" || prefersReducedMotion()) {
      apply();
      return;
    }

    // クリック位置（ボタン中心）と、四隅までの最大半径を求める。
    const rect = wrapRef.current?.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = rect ? rect.left + rect.width / 2 : vw / 2;
    const y = rect ? rect.top + rect.height / 2 : vh / 2;
    const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${maxRadius}px at ${x}px ${y}px)`,
    ];

    const root = document.documentElement;
    root.dataset.themeVt = "active";
    // Firefox 対策: スナップショット〜JSアニメ開始までの一瞬、新テーマが
    // 全面表示されないよう収縮状態のクリップを CSS で固定する。
    root.style.setProperty("--theme-vt-clip-from", clipPath[0]);
    const cleanup = () => {
      delete root.dataset.themeVt;
      root.style.removeProperty("--theme-vt-clip-from");
    };

    const transition = startViewTransition.call(document, () => {
      flushSync(apply);
    });
    transition.finished.finally(cleanup);
    transition.ready.then(() => {
      root.animate(
        { clipPath },
        {
          duration: VT_DURATION,
          easing: "ease-in-out",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  return (
    <span ref={wrapRef} className="inline-flex">
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        onPress={runToggle}
        aria-label={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        aria-pressed={isDark}
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </Button>
    </span>
  );
}
