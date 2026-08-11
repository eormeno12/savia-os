/**
 * Deterministic color for a space — the single source of truth that kills the
 * Chakra rainbow. Every space maps to one step of the brand `spaceScale`
 * (ink → teal → lime) plus its WCAG-AA readable ink, stable across reorders.
 *
 * - Determinism is keyed on `spaceId`, never on list index, so a space keeps its
 *   color when the list is reordered.
 * - The home/"General" space (`isDefault`) anchors to the ink base (step 1).
 * - Steps 1–5 are dark (paper text ≥ AA); steps 6–8 are light (ink text ≥ AA).
 *   See the contrast audit in the redesign plan (04-memory-map §5).
 */

/**
 * Steps assignable to regular spaces — step 1 (ink) is reserved for the home
 * space and step 8 (lime) for deliberate hero moments (the map's most-alive
 * area), so lime never lands on a light surface by hash accident.
 */
const ASSIGNABLE = [2, 3, 4, 5, 6, 7] as const;
/** Golden-ratio conjugate — spreads clustered hashes across the ramp. */
const PHI = 0.618_033_988_75;

export interface SpaceColor {
  /** Chakra color token for the cell fill, e.g. "spaceScale.5". */
  fill: string;
  /** Chakra color token for readable text on the fill: "paper" | "ink". */
  ink: string;
  /** The ramp step (1–8) — useful for ordering or debugging. */
  step: number;
}

/** Stable 32-bit FNV-1a hash of a string. */
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Readable text token for a given ramp step (mirrors the AA audit). */
function inkFor(step: number): string {
  return step <= 5 ? "paper" : "ink";
}

export function spaceColor(
  spaceId: string,
  opts?: { isDefault?: boolean },
): SpaceColor {
  if (opts?.isDefault) {
    return { fill: "spaceScale.1", ink: inkFor(1), step: 1 };
  }
  const norm = hash32(spaceId) / 0xffffffff; // [0, 1]
  const spread = (norm + PHI) % 1; // golden-ratio decorrelation
  const step = ASSIGNABLE[Math.floor(spread * ASSIGNABLE.length)];
  return { fill: `spaceScale.${step}`, ink: inkFor(step), step };
}
