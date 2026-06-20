/**
 * グローバルナビゲーションの項目定義（単一の真実の源）。
 * デスクトップの NavMenu とモバイルの BottomNav が共有する。
 * 設定は本ナビには含めず、ヘッダーの UserMenu からアクセスする。
 */

import type { ReactElement } from "react";

/** ナビ項目1件。icon は currentColor ベースのインライン SVG コンポーネント。 */
export type NavItem = {
  to: "/" | "/prices" | "/detail" | "/simulate";
  label: string;
  /** デスクトップのグリッド表示で添える短い説明。 */
  desc: string;
  icon: () => ReactElement;
};

/** 共通の SVG 属性（ThemeToggle のアイコンと同方式の stroke アイコン）。 */
const svgProps = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  width: 22,
  height: 22,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function HomeIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg {...svgProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg {...svgProps}>
      <path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1-2-1Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-3 3 3 5-6" />
    </svg>
  );
}

/** 表示順に並んだナビ項目（4項目）。 */
export const navItems: NavItem[] = [
  { to: "/", label: "ホーム", desc: "推移グラフと今期・来期サマリ", icon: HomeIcon },
  { to: "/prices", label: "月別入力", desc: "各月の単価・残業・手当を入力", icon: EditIcon },
  { to: "/detail", label: "給与の詳細", desc: "計算根拠と月次の実支給を確認", icon: ReceiptIcon },
  {
    to: "/simulate",
    label: "単価シミュレーション",
    desc: "仮単価で次の給与を試算",
    icon: ChartIcon,
  },
];
