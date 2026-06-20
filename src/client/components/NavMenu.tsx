import { useState } from "react";
import { Popover } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { navItems } from "../lib/navigation";

/** トリガー用の 2×2 グリッドアイコン。 */
function GridIcon() {
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

/**
 * デスクトップ用のヘッダーナビゲーション（md 以上で表示）。
 * アイコンボタンを押すと Popover が開き、項目がグリッドで並ぶ。
 * 項目クリックで遷移し、Popover を閉じる。
 */
export function NavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="メニューを開く"
        tabIndex={0}
        className="text-foreground hover:bg-surface-secondary hidden cursor-pointer items-center rounded-lg p-2 transition-colors md:flex"
      >
        <GridIcon />
      </Popover.Trigger>
      <Popover.Content>
        <Popover.Dialog aria-label="メインナビゲーション" className="p-2">
          <div className="grid w-[22rem] max-w-[80vw] grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={item.to === "/" ? { exact: true } : undefined}
                  onClick={() => setOpen(false)}
                  className="border-border hover:border-accent flex flex-col gap-1 rounded-lg border p-3 transition"
                  activeProps={{ className: "border-accent bg-accent/5" }}
                >
                  <span className="flex items-center gap-2">
                    <Icon />
                    <span className="text-sm font-medium">{item.label}</span>
                  </span>
                  <span className="text-muted text-xs">{item.desc}</span>
                </Link>
              );
            })}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
