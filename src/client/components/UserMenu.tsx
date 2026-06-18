import { Avatar, Dropdown, Label } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import type { ApiUser } from "@shared/types";

function userInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2);
}

/** ヘッダー用ユーザーメニュー。アバター＋名前のトリガーから設定・ログアウトへ。 */
export function UserMenu({
  user,
  onLogout,
}: {
  user: ApiUser;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  const handleAction = (key: string | number) => {
    if (key === "settings") {
      navigate({ to: "/settings" });
    } else if (key === "logout") {
      onLogout();
    }
  };

  return (
    <Dropdown>
      <Dropdown.Trigger className="hover:bg-surface-secondary flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors">
        <Avatar size="sm">
          <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
        </Avatar>
        <span className="max-w-32 truncate text-sm">{user.name}</span>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0">
              <p className="truncate text-sm leading-5 font-medium">{user.name}</p>
              <p className="text-muted truncate text-xs leading-none">
                {user.email}
              </p>
            </div>
          </div>
        </div>
        <Dropdown.Menu aria-label="ユーザーメニュー" onAction={handleAction}>
          <Dropdown.Item id="settings" textValue="設定">
            <Label>設定</Label>
          </Dropdown.Item>
          <Dropdown.Item id="logout" textValue="ログアウト" variant="danger">
            <Label>ログアウト</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
