/** クラス名を結合する最小ユーティリティ。falsy な値は除外する。 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
