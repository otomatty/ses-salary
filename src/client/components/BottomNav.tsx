import { Link } from "@tanstack/react-router";
import { navItems } from "../lib/navigation";

/**
 * モバイル用の画面下部固定ナビゲーション（md 未満で表示）。
 * デスクトップではヘッダーの NavMenu が役割を担うため md:hidden で隠す。
 */
export function BottomNav() {
  return (
    <nav
      aria-label="メインナビゲーション"
      className="bg-surface/80 border-border fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                activeOptions={item.to === "/" ? { exact: true } : undefined}
                className="text-muted flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] leading-tight transition-colors"
                activeProps={{ className: "text-accent" }}
              >
                <Icon />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
