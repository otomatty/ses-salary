import { useState } from "react";
import { Alert, Button, Separator } from "@heroui/react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ApiUser } from "@shared/types";
import { api } from "../api";
import { DotPattern } from "../components/DotPattern";
import { ThemeToggle } from "../components/ThemeToggle";

/** Google ブランドの 4 色ロゴ（公式配色）。ボタン左に添える。 */
function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.27a12 12 0 0 0 0 10.76l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/** ブランドアイコン（推移を表す上昇トレンド）。ブランドパネルの見出しに添える。 */
function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17l5-5 4 4 7-7" />
      <path d="M16 8h4v4" />
    </svg>
  );
}

/** ブランドパネルで訴求する特徴。 */
const FEATURES = [
  { title: "推移を可視化", desc: "単価と給与の推移をグラフで把握" },
  { title: "来期を予測", desc: "単価連動で来期の給与を先読み" },
  { title: "Tech ランク判定", desc: "単価帯から Gold / Silver / Bronze" },
] as const;

/** ログイン画面（PRD §8 画面1）。Google SSO。開発時は簡易ログインも可能。 */
export function Login({ onLoggedIn }: { onLoggedIn: (u: ApiUser) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 開発用ログインは本番ビルドでは表示しない
  const showDevLogin = import.meta.env.DEV;
  // OS / ブラウザの「視差効果を減らす」設定を尊重し、有効ならアニメを無効化する。
  const reduceMotion = useReducedMotion();

  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.devLogin();
      const me = await api.me();
      if (me.user) onLoggedIn(me.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // 右フォームの段階的な登場（stagger）。reduce-motion 時は無効化する。
  const container: Variants = reduceMotion
    ? {}
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
      };
  const item: Variants = reduceMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
      };

  return (
    <div className="bg-background flex min-h-screen flex-col lg:flex-row">
      {/* 左: ブランドパネル（モバイルでは上部の圧縮ヘッダーになる） */}
      <section
        aria-label="エンジニア給与計算"
        className="relative isolate overflow-hidden px-6 py-10 text-white sm:px-10 lg:w-[46%] lg:px-12 lg:py-16"
        style={{
          background:
            "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 55%, #000))",
        }}
      >
        {/* ドットパターン（薄く重ねる装飾） */}
        <DotPattern
          className="text-white/40 [mask-image:radial-gradient(ellipse_at_top_left,white,transparent_75%)]"
          width={22}
          height={22}
          cr={1}
        />
        {/* 斜めの光沢シャイン（控えめに1本） */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.16) 50%, transparent 58%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <BrandMark />
            </span>
            <span className="text-base font-semibold tracking-tight">
              エンジニア給与計算
            </span>
          </div>

          <div className="mt-8 lg:mt-auto">
            <h1 className="max-w-md text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              単価連動型の給与を、
              <br className="hidden sm:block" />
              計算・予測・可視化
            </h1>
            <p className="mt-3 max-w-md text-sm text-white/85 sm:text-base">
              月々の単価から給与をシミュレーションし、来期の見込みまでひと目で。
            </p>

            {/* 特徴3点（モバイルでは省略し、ヘッダーを圧縮する） */}
            <ul className="mt-8 hidden space-y-3 lg:block">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12l5 5L20 6" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{f.title}</span>
                    <span className="block text-xs text-white/75">{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 右: フォームパネル */}
      <main className="relative flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full max-w-sm"
        >
          <motion.div variants={item}>
            <h2 className="text-foreground text-2xl font-bold tracking-tight">
              おかえりなさい
            </h2>
            <p className="text-muted mt-1.5 text-sm">
              アカウントでログインして続行してください。
            </p>
          </motion.div>

          {error && (
            <motion.div variants={item} className="mt-5">
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            </motion.div>
          )}

          <motion.div variants={item} className="mt-6">
            <motion.div
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <Button
                fullWidth
                variant="primary"
                onPress={() => {
                  window.location.href = "/auth/login";
                }}
              >
                {/* 青背景にロゴが溶けないよう、白チップに載せる（Google ブランド準拠）。 */}
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                  <GoogleIcon />
                </span>
                <span className="ml-2">Google でログイン</span>
              </Button>
            </motion.div>
          </motion.div>

          {showDevLogin && (
            <motion.div variants={item} className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-muted text-xs">開発用</span>
                <Separator className="flex-1" />
              </div>
              <Button
                fullWidth
                variant="secondary"
                onPress={handleDevLogin}
                isDisabled={loading}
              >
                {loading ? "ログイン中…" : "開発用ログイン"}
              </Button>
              <p className="text-muted text-center text-xs">
                ローカル開発専用（本番では表示されません）
              </p>
            </motion.div>
          )}

          <motion.p variants={item} className="text-muted mt-8 text-center text-xs">
            自分のデータのみ閲覧・編集できます。
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
