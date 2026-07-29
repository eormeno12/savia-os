"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE_SAVIA } from "@savia-os/ui";
import type { PackedCell } from "@/lib/pack-layout";
import type { MapArea } from "./use-memory-data";
import { tokenVar } from "@/lib/token-var";

// Resolved once — lime for focus/live signals, paper for hairlines on ink.
const tokenLime = tokenVar("colors.signalLime");
const tokenHairline = tokenVar("colors.paper");

/** A packed cell enriched with its resolved (token-derived) colors. */
export type CellDatum = PackedCell<MapArea> & {
  /** CSS var for the fill. */
  fill: string;
  /** CSS var for readable text on the fill. */
  ink: string;
  /** The portrait's most-alive area — the only lime-solid bubble. */
  hero: boolean;
};

interface MemoryCellProps {
  cell: CellDatum;
  /** Stagger index (largest first) for the entry animation. */
  index: number;
  /** This cell is the focused/hovered one. */
  active: boolean;
  /** Another cell is active — dim this one to pull focus by contrast. */
  dimmed: boolean;
  onActivate: (id: string | null) => void;
  onSelect: (id: string) => void;
}

/** Round number with es-AR thousands separator. */
function fmt(n: number): string {
  return n.toLocaleString("es-AR");
}

/**
 * One area rendered as a packed circle with adaptive labelling and the
 * mockup's signal grammar: lime solid = the most-alive area, pulsing dot =
 * changed recently, outer ring = has sub-areas. Keyboard-focusable; the
 * accessible list lives in `MemoryList`.
 */
export function MemoryCell({ cell, index, active, dimmed, onActivate, onSelect }: MemoryCellProps) {
  const reduce = useReducedMotion();
  const { x, y, r, name, count, childCount, live, hero, fill, ink } = cell;

  // Adaptive content tiers by radius.
  const showName = r >= 40;
  const showCount = r >= 34;
  const showSub = r >= 52 && childCount > 0;
  const nameSize = Math.max(12, Math.min(22, r * 0.26));
  const countSize = Math.max(10, Math.min(15, r * 0.15));
  const initial = name.charAt(0).toUpperCase();
  // The live dot sits on the upper-right rim, inset toward the center.
  const dot = { x: x + r * 0.62, y: y - r * 0.62 };

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${name}: ${fmt(count)} recuerdos${childCount > 0 ? `, ${childCount} sub-áreas` : ""}`}
      style={{ cursor: "pointer", transformOrigin: `${x}px ${y}px`, outline: "none" }}
      initial={reduce ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: dimmed ? 0.45 : 1, y: active ? -6 : 0 }}
      transition={{
        scale: reduce
          ? { duration: 0 }
          : { delay: index * 0.045, type: "spring", stiffness: 180, damping: 18 },
        opacity: { duration: 0.2, ease: EASE_SAVIA },
        y: { duration: 0.22, ease: EASE_SAVIA },
      }}
      onMouseEnter={() => onActivate(cell.id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => onActivate(cell.id)}
      onBlur={() => onActivate(null)}
      onClick={() => onSelect(cell.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(cell.id);
        }
      }}
    >
      {/* outer ring = has sub-areas (the mockup's double ring) */}
      {childCount > 0 ? (
        <circle
          cx={x}
          cy={y}
          r={r + 5}
          fill="none"
          stroke={hero ? tokenLime : tokenHairline}
          strokeWidth={1}
          strokeOpacity={0.28}
        />
      ) : null}

      <circle
        cx={x}
        cy={y}
        r={r}
        fill={fill}
        stroke={active ? tokenLime : tokenHairline}
        strokeWidth={active ? 2 : 1}
        strokeOpacity={active ? 0.9 : 0.16}
      />

      {/* live pulse = changed in the last 48 h */}
      {live && !hero ? (
        <motion.circle
          cx={dot.x}
          cy={dot.y}
          r={4}
          fill={tokenLime}
          animate={reduce ? undefined : { opacity: [1, 0.45, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ pointerEvents: "none" }}
        />
      ) : null}

      {showName ? (
        <text
          x={x}
          y={showCount ? y - countSize * 0.4 : y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink}
          style={{ fontWeight: 600, fontSize: nameSize, pointerEvents: "none" }}
        >
          {name}
        </text>
      ) : (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink}
          style={{ fontWeight: 600, fontSize: Math.max(11, r * 0.5), pointerEvents: "none" }}
        >
          {initial}
        </text>
      )}
      {showName && showCount ? (
        <text
          x={x}
          y={y + nameSize * 0.75}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink}
          style={{ fontWeight: 500, fontSize: countSize, opacity: 0.7, pointerEvents: "none" }}
        >
          {fmt(count)}
          {showSub ? ` · ${childCount} sub` : ""}
        </text>
      ) : null}
    </motion.g>
  );
}
