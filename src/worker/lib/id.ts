/** UUID v4 を生成する（Workers の Web Crypto を利用） */
export function newId(): string {
  return crypto.randomUUID();
}
