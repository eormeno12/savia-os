"use client";

import { useCallback, useEffect, useState } from "react";
import type { AreaDto, AreaMemoryDto } from "@savia-os/legacy-contracts";
import { api } from "@/lib/api";

/** How recent an area's last change must be to earn the "viva" signal. */
const LIVE_WINDOW_MS = 48 * 60 * 60 * 1000;

/** One bubble of the map: a top-level area enriched with its signals. */
export interface MapArea {
  id: string;
  name: string;
  count: number;
  /** Share of the total portrait (0–1), for the peek and the list view. */
  share: number;
  /** Direct sub-areas underneath (double-ring signal). */
  childCount: number;
  /** Changed within the last 48 h (pulsing dot signal). */
  live: boolean;
  updatedAt: string;
}

export interface MemoryData {
  areas: MapArea[];
  /** Total memories in the whole portrait (the root's subtree count). */
  total: number;
  weekDelta: number;
  /** The home/"General" area — the resting place of the unclassified. */
  root: AreaDto | null;
  /** Latest memories across the portrait, for the "Recientes" strip. */
  recent: AreaMemoryDto[];
  /** id → name for resolving `areaIds` on memory rows. */
  areaNames: Map<string, string>;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: MemoryData };

function toMapAreas(all: AreaDto[], rootId: string | null, now: number): MapArea[] {
  const topLevel = all.filter((a) => !a.isDefault && a.parentId === rootId);
  const total = topLevel.reduce((sum, a) => sum + a.memoryCount, 0);
  return topLevel.map((a) => ({
    id: a.id,
    name: a.name,
    count: a.memoryCount,
    share: total > 0 ? a.memoryCount / total : 0,
    childCount: all.filter((c) => c.parentId === a.id).length,
    live: now - Date.parse(a.updatedAt) < LIVE_WINDOW_MS,
    updatedAt: a.updatedAt,
  }));
}

/**
 * Loads everything M1 needs in one round: the area taxonomy (bubbles come from
 * the root's direct children), the weekly growth delta, and the latest
 * memories. Client-side via the `api` boundary — authenticated dashboards are
 * dynamic and cookie-scoped.
 */
export function useMemoryData(): State & { reload: () => void } {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: "loading" });

    (async () => {
      const [all, summary] = await Promise.all([api.areas.list(), api.growth.summary("week")]);
      const root = all.find((a) => a.isDefault) ?? null;
      // The API may return a fuller page regardless of `limit`; the strip only
      // ever shows three.
      const recent = root ? (await api.areas.memories(root.id, undefined, 3)).items.slice(0, 3) : [];
      if (cancelled) return;
      setState({
        status: "ready",
        data: {
          areas: toMapAreas(all, root?.id ?? null, Date.now()),
          total: root?.memoryCount ?? all.reduce((sum, a) => sum + a.memoryCount, 0),
          weekDelta: summary.weekDelta,
          root,
          recent,
          areaNames: new Map(all.map((a) => [a.id, a.name])),
        },
      });
    })().catch(() => {
      if (!cancelled) setState({ status: "error" });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
}
