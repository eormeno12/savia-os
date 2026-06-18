/**
 * Orbital rings — Savia's atmospheric visual motif.
 *
 * Rendering model: fixed-px SVG, position:absolute, centered in parent.
 * Parent MUST have: position:relative + overflow:hidden
 * The rings extend far beyond the parent bounds by design — only arcs are visible.
 *
 * Usage:
 *   <Box position="relative" overflow="hidden">
 *     <OrbitalRingsHero />
 *     <Box position="relative" zIndex={1}>{content}</Box>
 *   </Box>
 */

type OrbitalRingsProps = {
  /** Number of concentric rings */
  count?: number;
  /** Inner ring radius in px — intentionally large so rings bleed out of parent */
  baseRadius?: number;
  /** Distance between rings in px */
  increment?: number;
  color?: string;
  /** Opacity of innermost ring — each subsequent ring decays ×0.72 */
  opacity?: number;
  strokeWidth?: number;
  /** Shift ring center horizontally from parent center, px. Positive = right. */
  offsetX?: number;
  /** Shift ring center vertically from parent center, px. Positive = down. */
  offsetY?: number;
  className?: string;
};

export function OrbitalRings({
  count = 5,
  baseRadius = 320,
  increment = 200,
  color = "#0B2529",
  opacity = 0.08,
  strokeWidth = 1,
  offsetX = 0,
  offsetY = 0,
  className,
}: OrbitalRingsProps) {
  const maxR = baseRadius + (count - 1) * increment;
  const size = (maxR + strokeWidth + 2) * 2;
  const c = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
        pointerEvents: "none",
        flexShrink: 0,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={c}
          cy={c}
          r={baseRadius + i * increment}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity * Math.pow(0.72, i)}
        />
      ))}
    </svg>
  );
}

// ─── Preset variants ──────────────────────────────────────────────────────────
// Scaled for real viewport usage (1200–1440px wide sections).
// Use offsetX/offsetY to shift the ring origin off-center.

type PresetProps = Pick<OrbitalRingsProps, "offsetX" | "offsetY" | "className">;

/** Light background hero — ink at 5.5% opacity, 6 rings */
export function OrbitalRingsHero({ offsetX, offsetY, className }: PresetProps = {}) {
  return (
    <OrbitalRings
      count={6}
      baseRadius={380}
      increment={220}
      color="#0B2529"
      opacity={0.055}
      offsetX={offsetX}
      offsetY={offsetY}
      className={className}
    />
  );
}

/** Dark (ink) background — paper at 8% opacity, 5 rings */
export function OrbitalRingsDark({ offsetX, offsetY, className }: PresetProps = {}) {
  return (
    <OrbitalRings
      count={5}
      baseRadius={360}
      increment={210}
      color="#F4F4F1"
      opacity={0.08}
      offsetX={offsetX}
      offsetY={offsetY}
      className={className}
    />
  );
}

/** Lime accent — emphasis moments only. 3 rings, dark backgrounds. */
export function OrbitalRingsLime({ offsetX, offsetY, className }: PresetProps = {}) {
  return (
    <OrbitalRings
      count={3}
      baseRadius={240}
      increment={160}
      color="#E7FF18"
      opacity={0.22}
      offsetX={offsetX}
      offsetY={offsetY}
      className={className}
    />
  );
}
