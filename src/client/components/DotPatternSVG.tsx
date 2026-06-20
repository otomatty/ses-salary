import React, { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "../lib/cn";
import type { DotPatternProps } from "./DotPattern";

/**
 * SVG 版 DotPattern（cursorHighlight なし時用・glow 対応）。
 *
 * framer-motion に依存するため、Canvas 専用パスのバンドルへ含めないよう
 * 別モジュールに分離し、DotPattern 側で lazy 読み込みする。
 */
export default function DotPatternSVG({
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
