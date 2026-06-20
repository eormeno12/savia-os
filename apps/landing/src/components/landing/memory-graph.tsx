'use client';

import dynamic from 'next/dynamic';
import { Box, Flex, Text } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND_COLORS, EASE_SAVIA } from '@/lib/constants';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type GraphNode = { id: string; name: string; type: string };
type GraphLink = { source: string; target: string; label: string };
type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

/* eslint-disable @typescript-eslint/no-explicit-any */
type GraphMethods = { zoomToFit: (duration?: number, padding?: number) => void };

const NODE_COLORS: Record<string, string> = {
  Person:       BRAND_COLORS.lime,
  Organization: '#60A5FA',
  Company:      '#60A5FA',
  Role:         '#F59E0B',
  Tool:         '#34D399',
  Product:      '#A78BFA',
  Topic:        '#F472B6',
  Skill:        '#34D399',
  Project:      '#A78BFA',
  Location:     '#F59E0B',
};

const LEGEND = [
  { label: 'Persona',     color: BRAND_COLORS.lime },
  { label: 'Empresa',     color: '#60A5FA' },
  { label: 'Rol',         color: '#F59E0B' },
  { label: 'Herramienta', color: '#34D399' },
  { label: 'Tema',        color: '#F472B6' },
];

function getNodeColor(type: string): string {
  return NODE_COLORS[type] ?? '#6B7280';
}

export function MemoryGraph({
  userId,
  refreshTrigger,
}: {
  userId: string;
  refreshTrigger: number;
}) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphMethods | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Callback ref — fires whenever the canvas container mounts/unmounts.
  // Unlike useEffect([]), this correctly sets up the ResizeObserver even when
  // the container only enters the DOM after the first graph data arrives.
  useEffect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [containerEl]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/demo/graph?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => { setGraphData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId, refreshTrigger]);

  const nodeColor = useCallback((node: object) => getNodeColor((node as GraphNode).type), []);

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { x, y, name } = node as GraphNode & { x: number; y: number };
      const fontSize = Math.max(3.5, 4.5 / globalScale);
      ctx.font = `600 ${fontSize}px var(--font-inter, system-ui, sans-serif)`;
      ctx.fillStyle = 'rgba(244,244,241,0.92)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = name.length > 18 ? name.slice(0, 16) + '…' : name;
      ctx.fillText(label, x, y + 9);
    },
    [],
  );

  const handleEngineStop = useCallback(() => {
    graphRef.current?.zoomToFit(400, 40);
  }, []);

  const isEmpty = graphData.nodes.length === 0;

  return (
    <Box
      display="flex"
      flexDirection="column"
      bg="bg.inverse"
      borderRadius="panel"
      borderTopWidth="2px"
      borderTopColor="fg.inverse/12"
      borderWidth="1px"
      borderColor="fg.inverse/10"
      overflow="hidden"
      h="100%"
    >
      {/* Header */}
      <Box
        px="5"
        py="4"
        borderBottomWidth="1px"
        borderColor="fg.inverse/10"
        flexShrink={0}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box>
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Text textStyle="label" color="fg.inverse">Mapa de memoria</Text>
          </motion.div>
          <Text fontSize="xs" color="fg.inverse/55" mt="0.5">
            {loading
              ? 'Actualizando…'
              : isEmpty
                ? 'Chatea para ver el mapa crecer'
                : `${graphData.nodes.length} entidades · ${graphData.links.length} conexiones`}
          </Text>
        </Box>

        {loading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            style={{ width: 14, height: 14, flexShrink: 0 }}
          >
            <Box
              w="14px"
              h="14px"
              borderRadius="full"
              borderWidth="2px"
              borderColor="fg.inverse/20"
              borderTopColor="signalLime"
              style={{ display: 'block' }}
            />
          </motion.div>
        )}
      </Box>

      {/* Legend */}
      {!isEmpty && !loading && (
        <Flex gap="2" px="4" pt="2" pb="1" flexWrap="wrap" flexShrink={0}>
          {LEGEND.map((l) => (
            <Box
              key={l.label}
              display="inline-flex"
              alignItems="center"
              gap="1.5"
              px="2"
              py="0.5"
              borderRadius="chip"
              bg="fg.inverse/8"
              fontSize="2xs"
              color="fg.inverse/70"
            >
              <Box w="6px" h="6px" borderRadius="full" style={{ background: l.color }} flexShrink={0} />
              {l.label}
            </Box>
          ))}
        </Flex>
      )}

      {/* Graph / empty state */}
      {isEmpty ? (
        <Box flex="1" display="flex" alignItems="center" justifyContent="center" px="6">
          <Text fontSize="sm" color="fg.inverse/40" textAlign="center">
            {loading ? 'Cargando…' : 'Selecciona una persona y chatea'}
          </Text>
        </Box>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${graphData.nodes.length}-${graphData.links.length}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: EASE_SAVIA }}
            style={{ flex: 1, minHeight: 0, position: 'relative' }}
          >
            {/* Absolute fill so the canvas always matches the available space */}
            <Box
              ref={setContainerEl}
              position="absolute"
              inset={0}
              overflow="hidden"
            >
              {dims.w > 0 && dims.h > 0 && (
                <ForceGraph2D
                  ref={graphRef as any}
                  graphData={graphData}
                  width={dims.w}
                  height={dims.h}
                  backgroundColor={BRAND_COLORS.ink}
                  nodeLabel="name"
                  nodeColor={nodeColor}
                  nodeRelSize={5}
                  linkLabel="label"
                  linkColor={() => 'rgba(244,244,241,0.15)'}
                  linkDirectionalArrowLength={3}
                  linkDirectionalArrowRelPos={1}
                  linkWidth={1}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleSpeed={0.004}
                  linkDirectionalParticleColor={() => BRAND_COLORS.lime}
                  nodeCanvasObjectMode={() => 'after'}
                  nodeCanvasObject={nodeCanvasObject}
                  warmupTicks={60}
                  cooldownTicks={0}
                  onEngineStop={handleEngineStop}
                />
              )}
            </Box>
          </motion.div>
        </AnimatePresence>
      )}
    </Box>
  );
}
