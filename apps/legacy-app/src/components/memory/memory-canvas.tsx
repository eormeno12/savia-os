"use client";

import { useMemo, useState } from "react";
import { Box, HStack, Text } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import { SaviaMark, EASE_SAVIA } from "@savia-os/ui";
import { packAreas, type PackedCell } from "@/lib/pack-layout";
import { tokenVar } from "@/lib/token-var";
import type { MapArea } from "./use-memory-data";
import { MemoryCell, type CellDatum } from "./memory-cell";

/** Layout coordinate space — fixed aspect, scaled to fit by the SVG viewBox. */
const VIEW = { width: 900, height: 480 };

const paperVar = tokenVar("colors.paper");
const limeVar = tokenVar("colors.signalLime");
const inkVar = tokenVar("colors.ink");

/**
 * Canvas fills stay in the ink family (the mockup's calm dark-on-dark): the
 * hero is the only lime; live areas cycle the deep teal steps; cold areas go
 * translucent paper. Identity color for lists/glyphs remains `spaceColor` —
 * here size and signals carry the meaning, not hue.
 */
const DARK_FILLS = ["colors.spaceScale.2", "colors.spaceScale.3", "colors.spaceScale.4"] as const;
const COLD_FILL = `color-mix(in srgb, ${paperVar} 13%, transparent)`; // paper @ 13% on ink

function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * `pack()` produces a tight central cluster; the mockup spreads bubbles across
 * the whole canvas. Expanding every center away from the middle preserves
 * pairwise distances (no overlaps) while filling the frame.
 */
function spread(cells: PackedCell<MapArea>[]): PackedCell<MapArea>[] {
  if (cells.length < 2) return cells;
  const cx = VIEW.width / 2;
  const cy = VIEW.height / 2;
  const margin = 18;
  let k = Infinity;
  for (const c of cells) {
    const dx = Math.abs(c.x - cx);
    const dy = Math.abs(c.y - cy);
    if (dx > 1) k = Math.min(k, (VIEW.width / 2 - c.r - margin) / dx);
    if (dy > 1) k = Math.min(k, (VIEW.height / 2 - c.r - margin) / dy);
  }
  if (!Number.isFinite(k) || k <= 1) return cells;
  const factor = Math.min(k, 1.65);
  return cells.map((c) => ({ ...c, x: cx + (c.x - cx) * factor, y: cy + (c.y - cy) * factor }));
}

interface MemoryCanvasProps {
  areas: MapArea[];
  /** The home area — the quiet corner link to everything still unclassified. */
  rootId?: string;
  onSelect: (id: string) => void;
}

/**
 * Picks the portrait's hero: the most-alive area (live + largest), falling
 * back to the largest. Exactly one bubble earns the lime-solid fill.
 */
function heroId(areas: MapArea[]): string | null {
  if (areas.length === 0) return null;
  const bySize = [...areas].sort((a, b) => b.count - a.count);
  return (bySize.find((a) => a.live) ?? bySize[0]).id;
}

/**
 * The living portrait: an ink canvas where each area is a packed circle. The
 * signal grammar comes from the mockup — lime solid = most alive, pulsing dot
 * = recent change, outer ring = sub-areas. The faint SAVIA mark breathes at
 * the center. Decorative (`aria-hidden`); the accessible list is `MemoryList`.
 */
export function MemoryCanvas({ areas, rootId, onSelect }: MemoryCanvasProps) {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Pack once per data change; enrich with token-derived colors. Stagger order
  // is largest-first so the big cells land before the small ones.
  const cells = useMemo<CellDatum[]>(() => {
    const hero = heroId(areas);
    return spread(packAreas(areas, VIEW))
      .map((c) => {
        if (c.id === hero) return { ...c, hero: true, fill: limeVar, ink: inkVar };
        if (!c.live) return { ...c, hero: false, fill: COLD_FILL, ink: paperVar };
        const fill = DARK_FILLS[hash32(c.id) % DARK_FILLS.length];
        return { ...c, hero: false, fill: tokenVar(fill), ink: paperVar };
      })
      .sort((a, b) => b.r - a.r);
  }, [areas]);

  const active = activeId ? (cells.find((c) => c.id === activeId) ?? null) : null;

  return (
    <Box
      position="relative"
      h="clamp(420px, 54vh, 620px)"
      bg="bg.inverse"
      rounded="card"
      overflow="hidden"
    >
      {/* lime glow — the signature depth of every ink surface */}
      <Box
        position="absolute"
        w="420px"
        h="420px"
        rounded="full"
        bg="lime.solid"
        filter="blur(150px)"
        opacity="0.07"
        bottom="-160px"
        insetEnd="-100px"
      />

      {/* corner whisper — the product's promise, stated where it happens */}
      <Box position="absolute" top="5" insetStart="6" zIndex="2">
        <Text fontSize="12px" color="fg.inverse/50">
          Organizada por Savia — corrígela cuando quieras.
        </Text>
      </Box>

      {/* the resting place of the unclassified */}
      {rootId ? (
        <Box position="absolute" bottom="5" insetStart="6" zIndex="2">
          <Text
            as="button"
            fontSize="12px"
            color="fg.inverse/50"
            cursor="pointer"
            _hover={{ color: "fg.inverse/85" }}
            transition="color 0.16s"
            onClick={() => onSelect(rootId)}
          >
            General — lo que aún no tiene área propia →
          </Text>
        </Box>
      ) : null}

      {/* signal legend */}
      <HStack position="absolute" top="5" insetEnd="6" zIndex="2" gap="4" aria-hidden>
        <HStack gap="1.5">
          <Box w="2" h="2" rounded="full" bg="lime.solid" />
          <Text fontSize="12px" color="fg.inverse/60">
            Viva
          </Text>
        </HStack>
        <HStack gap="1.5">
          <Box w="2.5" h="2.5" rounded="full" borderWidth="1px" borderColor="fg.inverse/50" />
          <Text fontSize="12px" color="fg.inverse/60">
            Con sub-áreas
          </Text>
        </HStack>
      </HStack>

      {/* breathing mark, behind the cells */}
      <Box
        position="absolute"
        inset="0"
        display="flex"
        alignItems="center"
        justifyContent="center"
        pointerEvents="none"
        aria-hidden
      >
        <motion.div
          initial={false}
          animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
          transition={{ duration: 6, ease: EASE_SAVIA, repeat: Infinity }}
          style={{ opacity: 0.05 }}
        >
          <SaviaMark size={240} color={paperVar} />
        </motion.div>
      </Box>

      {/* cells */}
      <Box position="absolute" inset="0" zIndex="1">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
          style={{ display: "block" }}
        >
          {cells.map((cell, i) => (
            <MemoryCell
              key={cell.id}
              cell={cell}
              index={i}
              active={activeId === cell.id}
              dimmed={activeId !== null && activeId !== cell.id}
              onActivate={setActiveId}
              onSelect={onSelect}
            />
          ))}
        </svg>
      </Box>

      {/* peek */}
      {active ? (
        <Box
          position="absolute"
          zIndex="3"
          pointerEvents="none"
          left={`${(active.x / VIEW.width) * 100}%`}
          top={`${((active.y - active.r) / VIEW.height) * 100}%`}
          transform="translate(-50%, calc(-100% - 8px))"
          bg="bg.panel"
          color="fg"
          rounded="message"
          shadow="float"
          px="3.5"
          py="2.5"
          minW="max-content"
        >
          <Text fontSize="14px" fontWeight="600">
            {active.name}
          </Text>
          <Text fontSize="12px" color="fg.muted">
            {active.count.toLocaleString("es-AR")} recuerdos · {Math.round(active.share * 100)}%
            {active.childCount > 0
              ? ` · ${active.childCount} ${active.childCount === 1 ? "sub-área" : "sub-áreas"}`
              : ""}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
