import React, { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "../lib/cn";

/** 現在のテーマがダークかどうかを html の `dark` クラスから判定する。 */
function isDarkMode(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

/** マウス位置の補間係数（大きいほど素早く追従、小さいほどぬるぬる） */
const SMOOTHING = 0.14;

/**
 *  DotPattern Component Props
 *
 * @param {number} [width=16] - The horizontal spacing between dots
 * @param {number} [height=16] - The vertical spacing between dots
 * @param {number} [x=0] - The x-offset of the entire pattern
 * @param {number} [y=0] - The y-offset of the entire pattern
 * @param {number} [cx=1] - The x-offset of individual dots
 * @param {number} [cy=1] - The y-offset of individual dots
 * @param {number} [cr=1] - The radius of each dot
 * @param {string} [className] - Additional CSS classes to apply to the container
 * @param {boolean} [glow=false] - Whether dots should have a glowing animation effect (SVG only)
 * @param {boolean} [cursorHighlight=false] - カーソル付近のドットをハイライト（true で Canvas 使用・軽量＆ぬるぬる）
 * @param {number} [cursorHighlightRadius=120] - カーソルからこの半径（px）内のドットがハイライトされる
 * @param {number} [cursorHighlightScale=1.55] - カーソル直下のドットの半径倍率
 */
interface DotPatternProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
  style?: React.CSSProperties;
  glow?: boolean;
  cursorHighlight?: boolean;
  cursorHighlightRadius?: number;
  cursorHighlightScale?: number;
  [key: string]: unknown;
}

/**
 * DotPattern Component
 *
 * - cursorHighlight が true のとき: Canvas で描画。マウス位置を補間してぬるぬる追従し、描画も軽量。
 * - cursorHighlight が false のとき: SVG で描画（glow 対応）。
 */
export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  glow = false,
  cursorHighlight = false,
  cursorHighlightRadius = 120,
  cursorHighlightScale = 1.8,
  style: propsStyle,
  ...rest
}: DotPatternProps) {
  if (cursorHighlight) {
    return (
      <DotPatternCanvas
        width={width}
        height={height}
        x={x}
        y={y}
        cx={cx}
        cy={cy}
        cr={cr}
        className={className}
        cursorHighlightRadius={cursorHighlightRadius}
        cursorHighlightScale={cursorHighlightScale}
        isDark={isDarkMode()}
        style={propsStyle}
        {...rest}
      />
    );
  }

  return (
    <DotPatternSVG
      width={width}
      height={height}
      x={x}
      y={y}
      cx={cx}
      cy={cy}
      cr={cr}
      className={className}
      glow={glow}
      style={propsStyle}
      {...rest}
    />
  );
}

/** Canvas 版: 1枚の Canvas で描画し、lerp でマウスを補間。React の再レンダーなしでぬるぬる動く。 */
function DotPatternCanvas({
  width = 16,
  height: heightStep = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  cursorHighlightRadius = 120,
  cursorHighlightScale = 1.8,
  isDark,
  style: propsStyle,
  ...rest
}: DotPatternProps & { isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseTargetRef = useRef<{ x: number; y: number } | null>(null);
  const mouseSmoothedRef = useRef<{ x: number; y: number } | null>(null);
  const isDarkRef = useRef(isDark);
  const sizeRef = useRef({ w: 0, h: 0 });
  isDarkRef.current = isDark;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 再描画はイベント駆動。アイドル時は frame を予約しないことで常時負荷を避ける。
    let rafId: number | null = null;
    const requestDraw = () => {
      if (rafId == null) rafId = requestAnimationFrame(draw);
    };
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w <= 0 || h <= 0) return;
      sizeRef.current = { w, h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      rafId = null;
      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;

      const target = mouseTargetRef.current;
      let smoothed = mouseSmoothedRef.current;
      // lerp が収束しきっていなければ次フレームを予約して動きを継続する。
      let animating = false;

      if (target) {
        if (!smoothed) {
          smoothed = { x: target.x, y: target.y };
          mouseSmoothedRef.current = smoothed;
        } else {
          const dx = target.x - smoothed.x;
          const dy = target.y - smoothed.y;
          if (Math.hypot(dx, dy) > 0.5) {
            smoothed.x += dx * SMOOTHING;
            smoothed.y += dy * SMOOTHING;
            animating = true;
          } else {
            smoothed.x = target.x;
            smoothed.y = target.y;
          }
        }
      } else {
        mouseSmoothedRef.current = null;
        smoothed = null;
      }

      ctx.clearRect(0, 0, w, h);

      const cols = Math.ceil(w / width) || 1;
      const rows = Math.ceil(h / heightStep) || 1;
      const dark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = col * width + x + cx;
          const py = row * heightStep + y + cy;
          let r = cr;
          let fillR: number;
          let fillG: number;
          let fillB: number;
          let fillA: number;

          if (smoothed) {
            const d = Math.hypot(smoothed.x - px, smoothed.y - py);
            if (d < cursorHighlightRadius) {
              const t = Math.pow(1 - d / cursorHighlightRadius, 2);
              r = cr * (1 + (cursorHighlightScale - 1) * t);
              const alpha = dark ? 0.12 + 0.5 * t : 0.5 + 0.5 * t;
              if (dark) {
                fillR = 255;
                fillG = 255;
                fillB = 255;
                fillA = alpha;
              } else {
                fillR = 0;
                fillG = 0;
                fillB = 0;
                fillA = alpha;
              }
            } else if (dark) {
              fillR = 255;
              fillG = 255;
              fillB = 255;
              fillA = 0.15;
            } else {
              fillR = 0;
              fillG = 0;
              fillB = 0;
              fillA = 0.25;
            }
          } else if (dark) {
            fillR = 255;
            fillG = 255;
            fillB = 255;
            fillA = 0.15;
          } else {
            fillR = 0;
            fillG = 0;
            fillB = 0;
            fillA = 0.25;
          }

          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${fillR},${fillG},${fillB},${fillA})`;
          ctx.fill();
        }
      }

      if (animating) requestDraw();
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseTargetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      requestDraw();
    };

    const onMouseOut = (e: MouseEvent) => {
      if (e.relatedTarget == null) {
        mouseTargetRef.current = null;
        requestDraw();
      }
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      requestDraw();
    });
    ro.observe(container);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseout", onMouseOut);
    // テーマ切替（html の `dark` クラス変化）でも色を更新する。
    const themeObserver = new MutationObserver(() => requestDraw());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    requestDraw();

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseout", onMouseOut);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [width, heightStep, x, y, cx, cy, cr, cursorHighlightRadius, cursorHighlightScale]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full text-neutral-400/80",
        className
      )}
      style={{
        contain: "paint",
        ...(typeof propsStyle === "object" && propsStyle != null
          ? propsStyle
          : {}),
      }}
      {...rest}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{ verticalAlign: "top" }}
      />
    </div>
  );
}

/** SVG 版: cursorHighlight なし時用（glow 対応）。 */
function DotPatternSVG({
  width = 16,
  height: heightStep = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  glow = false,
  style: propsStyle,
  ...rest
}: DotPatternProps) {
  const id = useId();
  const containerRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width: w, height: h } =
          containerRef.current.getBoundingClientRect();
        setDimensions({ width: w, height: h });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const cols = Math.ceil(dimensions.width / width) || 1;
  const rows = Math.ceil(dimensions.height / heightStep) || 1;
  const dots = React.useMemo(
    () =>
      Array.from({ length: cols * rows }, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
          x: col * width + x + cx,
          y: row * heightStep + y + cy,
          delay: Math.random() * 5,
          duration: Math.random() * 3 + 2,
        };
      }),
    [cols, rows, width, heightStep, x, y, cx, cy]
  );

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full text-neutral-400/80",
        className
      )}
      style={
        typeof propsStyle === "object" && propsStyle != null
          ? propsStyle
          : undefined
      }
      {...(rest as React.SVGProps<SVGSVGElement>)}
    >
      <defs>
        <radialGradient id={`${id}-gradient`}>
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {dots.map((dot) => (
        <motion.circle
          key={`${dot.x}-${dot.y}`}
          cx={dot.x}
          cy={dot.y}
          r={cr}
          fill={glow ? `url(#${id}-gradient)` : "currentColor"}
          initial={glow ? { opacity: 0.4, scale: 1 } : {}}
          animate={
            glow
              ? { opacity: [0.4, 1, 0.4] as const, scale: [1, 1.5, 1] as const }
              : {}
          }
          transition={
            glow
              ? {
                  duration: dot.duration,
                  repeat: Infinity,
                  repeatType: "reverse" as const,
                  delay: dot.delay,
                  ease: "easeInOut",
                }
              : {}
          }
        />
      ))}
    </svg>
  );
}
