/**
 * Circle-packing layout for the memory map.
 *
 * Pure and generic: turns anything with `{ id, count }` into a packed circle
 * whose **area** (not radius) is proportional to its count, so the eye
 * compares magnitudes correctly. Uses `d3-hierarchy`'s `pack()` — the only
 * external dependency the map needs.
 *
 * Determinism: the input is sorted by `id` before packing, so the portrait is
 * stable across loads and never "jumps" between visits.
 */
import { hierarchy, pack } from "d3-hierarchy";

export interface PackInput {
  id: string;
  count: number;
}

export type PackedCell<T extends PackInput> = T & {
  /** Center x in the layout coordinate space. */
  x: number;
  /** Center y in the layout coordinate space. */
  y: number;
  /** Circle radius in the layout coordinate space. */
  r: number;
};

export interface PackSize {
  width: number;
  height: number;
}

/** Stable string compare (ids are opaque, so lexicographic is fine). */
function byId(a: PackInput, b: PackInput): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Pack `items` into circles that fit `size`. Returns one cell per item with its
 * center and radius. Empty input yields an empty layout.
 */
export function packAreas<T extends PackInput>(items: T[], size: PackSize): PackedCell<T>[] {
  if (items.length === 0) return [];

  // Fixed input order → deterministic layout. Value-sort (big first) only
  // drives visual prominence; both are deterministic given the same data.
  const ordered = [...items].sort(byId);

  const root = hierarchy<{ children: T[] } | T>(
    { children: ordered },
    (node) => ("children" in node ? (node.children as T[]) : null),
  )
    .sum((node) => ("count" in node ? Math.max(1, node.count) : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const layout = pack<{ children: T[] } | T>()
    .size([size.width, size.height])
    .padding(12);

  const packed = layout(root);

  return packed.leaves().map((leaf) => {
    const data = leaf.data as T;
    return { ...data, x: leaf.x, y: leaf.y, r: leaf.r };
  });
}
