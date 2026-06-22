"use client";

import { useState } from "react";
import { Box, Text, HStack, Button } from "@chakra-ui/react";
import type { GrowthSummary, GrowthPoint } from "@/lib/api";

interface Props {
  summary: GrowthSummary;
  range: 'day' | 'week';
  onRangeChange: (r: 'day' | 'week') => void;
}

const CHART_H = 140;
const BAR_W = 28;
const GAP = 4;

const SPACE_COLORS: Record<string, string> = {};
const BASE_COLORS = [
  '#4299e1', '#9f7aea', '#38b2ac', '#ed8936',
  '#ed64a6', '#48bb78', '#0bc5ea', '#fc8181',
];
let colorIdx = 0;

function getColor(spaceId: string): string {
  if (!SPACE_COLORS[spaceId]) {
    SPACE_COLORS[spaceId] = BASE_COLORS[colorIdx % BASE_COLORS.length];
    colorIdx++;
  }
  return SPACE_COLORS[spaceId];
}

function formatBucket(bucket: string, range: 'day' | 'week'): string {
  const d = new Date(bucket);
  if (range === 'day') {
    return `${d.getHours().toString().padStart(2, '0')}h`;
  }
  return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
}

export function GrowthChart({ summary, range, onRangeChange }: Props) {
  const { points } = summary;

  if (points.length === 0) {
    return (
      <Box p="6" textAlign="center">
        <Text fontSize="sm" color="fg.muted">
          Sin datos de crecimiento para este período.
        </Text>
      </Box>
    );
  }

  // Group by bucket
  const buckets = [...new Set(points.map((p) => p.bucket))].sort();
  const bucketTotals = new Map<string, number>();
  buckets.forEach((b) => {
    const total = points.filter((p) => p.bucket === b).reduce((s, p) => s + p.count, 0);
    bucketTotals.set(b, total);
  });

  const maxTotal = Math.max(...Array.from(bucketTotals.values()), 1);

  const totalW = buckets.length * (BAR_W + GAP);

  return (
    <Box>
      <HStack justify="space-between" mb="4">
        <Text fontSize="sm" fontWeight="600" color="fg">Crecimiento</Text>
        <HStack gap="1">
          {(['day', 'week'] as const).map((r) => (
            <Button
              key={r}
              size="xs"
              variant={range === r ? "solid" : "outline"}
              onClick={() => onRangeChange(r)}
            >
              {r === 'day' ? 'Hoy' : 'Semana'}
            </Button>
          ))}
        </HStack>
      </HStack>

      {/* SVG bar chart */}
      <Box overflowX="auto">
        <svg
          width={Math.max(totalW, 300)}
          height={CHART_H + 40}
          style={{ display: 'block' }}
        >
          {buckets.map((bucket, i) => {
            const x = i * (BAR_W + GAP);
            const total = bucketTotals.get(bucket) ?? 0;
            const barH = Math.max(2, Math.round((total / maxTotal) * CHART_H));
            const y = CHART_H - barH;

            // Stack segments by space
            const segs = points.filter((p) => p.bucket === bucket);
            let segY = CHART_H;
            const stackedSegs = segs.map((seg) => {
              const segH = Math.round((seg.count / maxTotal) * CHART_H);
              const rect = { y: segY - segH, h: segH, color: getColor(seg.spaceId) };
              segY -= segH;
              return { ...seg, ...rect };
            });

            return (
              <g key={bucket}>
                {stackedSegs.map((seg, j) => (
                  <rect
                    key={j}
                    x={x}
                    y={seg.y}
                    width={BAR_W}
                    height={seg.h}
                    fill={seg.color}
                    rx={j === stackedSegs.length - 1 ? 3 : 0}
                  >
                    <title>{seg.spaceName}: {seg.count}</title>
                  </rect>
                ))}
                {/* Count label */}
                {total > 0 && (
                  <text
                    x={x + BAR_W / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#718096"
                  >
                    {total}
                  </text>
                )}
                {/* Bucket label */}
                <text
                  x={x + BAR_W / 2}
                  y={CHART_H + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#718096"
                >
                  {formatBucket(bucket, range)}
                </text>
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
